import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { baselineSql } from '../../../../../scripts/groq-production/export-budget.mjs'

let db: PGlite
const actor = '10000000-0000-4000-8000-000000000001'
const first = '20000000-0000-4000-8000-000000000001'
const second = '20000000-0000-4000-8000-000000000002'
const reserve = (id = first, tokens = 1500) =>
  db.query('select public.ecocleaner_llm_reserve($1,$2,$3,$4,$5) as state', [
    id,
    actor,
    tokens,
    'a'.repeat(64),
    'Hola',
  ])
const state = async () =>
  (
    await db.query<{ state: { usedTokenBudget: number; generations: number } }>(
      'select public.ecocleaner_llm_state() as state',
    )
  ).rows[0].state

beforeAll(async () => {
  db = new PGlite()
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${actor}');`,
  )
  await db.exec(
    await readFile(
      new URL(
        '../../../../../supabase/migrations/20261017150000_llm_production_quota.sql',
        import.meta.url,
      ),
      'utf8',
    ),
  )
}, 30000)
beforeEach(async () => {
  await db.exec(
    'truncate public.ecocleaner_llm_requests; update public.ecocleaner_llm_pool set used_tokens=73706, generations=32, provisioned=true, active_request=null, active_since=null, halted=false;',
  )
})
afterAll(async () => {
  await db?.close()
})

describe('cuota persistente ejecutada en PostgreSQL', () => {
  it('la importación conserva el consumo y solo se ejecuta una vez', async () => {
    await db.exec(
      'update public.ecocleaner_llm_pool set provisioned=false, used_tokens=80000, generations=100',
    )
    const sql = baselineSql({
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      authorizedTokenBudget: 80000,
      usedTokenBudget: 73706,
      maxGenerations: 100,
      generations: 32,
      busy: false,
      halted: 'SESSION_TRANSFERRED',
    })
    await db.exec(sql)
    expect(await state()).toMatchObject({
      usedTokenBudget: 73706,
      generations: 32,
    })
    await expect(db.exec(sql)).rejects.toThrow(
      'El consumo ya está inicializado',
    )
    expect(() =>
      baselineSql({
        provider: 'groq',
        model: 'openai/gpt-oss-20b',
        authorizedTokenBudget: 90000,
        usedTokenBudget: 73706,
        maxGenerations: 100,
        generations: 32,
        busy: false,
      }),
    ).toThrow()
  })
  it('anon y authenticated no pueden leer ni reservar ni resetear consumo', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role)
      try {
        await expect(
          db.query('select * from public.ecocleaner_llm_pool'),
        ).rejects.toThrow(/permission denied/)
        await expect(reserve()).rejects.toThrow(/permission denied/)
      } finally {
        await db.exec('reset role')
      }
    }
  })
  it('reserva de forma durable y bloquea la segunda instancia', async () => {
    const reservation = await reserve()
    expect(reservation.rows[0].state).toMatchObject({
      generations: 33,
      usedTokenBudget: 75206,
      busy: true,
    })
    expect(await state()).toMatchObject({
      generations: 33,
      usedTokenBudget: 75206,
    })
    await expect(reserve(second)).rejects.toThrow('BUSY')
    expect(await state()).toMatchObject({
      generations: 33,
      usedTokenBudget: 75206,
    })
  })
  it('rechaza la llamada que excedería el saldo sin aumentar contadores', async () => {
    await expect(reserve(first, 7000)).rejects.toThrow('DAILY_TOKEN_BUDGET')
    expect(await state()).toMatchObject({
      generations: 32,
      usedTokenBudget: 73706,
    })
  })
  it('no renueva el presupuesto por cambio de proceso o de día', async () => {
    await db.exec('update public.ecocleaner_llm_pool set used_tokens=80000;')
    await expect(reserve()).rejects.toThrow('DAILY_TOKEN_BUDGET')
  })
  it('libera solo el sobrante del uso verificado y no permite finalizar dos veces', async () => {
    await reserve()
    await db.query(
      'select public.ecocleaner_llm_finish($1,420,$2,null,false)',
      [first, { ok: true }],
    )
    expect(await state()).toMatchObject({
      generations: 33,
      usedTokenBudget: 74126,
    })
    await expect(
      db.query('select public.ecocleaner_llm_finish($1,1,$2,null,false)', [
        first,
        { ok: true },
      ]),
    ).rejects.toThrow('ALREADY_FINALIZED')
    expect((await state()).usedTokenBudget).toBe(74126)
  })
  it('una caída sin uso reportado conserva la reserva completa', async () => {
    await reserve()
    await db.query(
      'select public.ecocleaner_llm_finish($1,null,$2,null,false)',
      [first, { ok: false }],
    )
    expect((await state()).usedTokenBudget).toBe(75206)
  })
  it('vencer un bloqueo no borra los tokens reservados por la instancia perdida', async () => {
    await reserve()
    await db.exec(
      "update public.ecocleaner_llm_pool set active_since=now()-interval '3 minutes'; update public.ecocleaner_llm_requests set created_at=now()-interval '3 minutes';",
    )
    await reserve(second)
    expect(await state()).toMatchObject({
      generations: 34,
      usedTokenBudget: 76706,
    })
  })
  it('un consumo mayor que la reserva se contabiliza y detiene la sesión', async () => {
    await reserve()
    await db.query(
      'select public.ecocleaner_llm_finish($1,1600,$2,null,false)',
      [first, { ok: true }],
    )
    expect((await state()).usedTokenBudget).toBe(75306)
    await expect(reserve(second)).rejects.toThrow('PROVIDER_REJECTED_SESSION')
  })
})
