import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function baselineSql(state) {
  if (
    state.provider !== 'groq' ||
    state.model !== 'openai/gpt-oss-20b' ||
    state.authorizedTokenBudget !== 80000 ||
    state.maxGenerations !== 100 ||
    !Number.isSafeInteger(state.usedTokenBudget) ||
    state.usedTokenBudget < 73706 ||
    !Number.isSafeInteger(state.generations) ||
    state.generations < 32 ||
    state.busy ||
    (state.halted && state.halted !== 'SESSION_TRANSFERRED')
  )
    throw new Error(
      'El estado no corresponde a la sesión autorizada y detenida entre consultas.',
    )
  return `-- Importación única del consumo conservado; no autoriza tokens nuevos.
do $baseline$
declare pool public.ecocleaner_llm_pool%rowtype;
begin
  select * into strict pool from public.ecocleaner_llm_pool where id='production' for update;
  if pool.provisioned or exists(select 1 from public.ecocleaner_llm_requests) then
    raise exception 'El consumo ya está inicializado; no se permite reiniciarlo.';
  end if;
  update public.ecocleaner_llm_pool set used_tokens=${state.usedTokenBudget}, generations=${state.generations}, provisioned=true
    where id='production' and authorized_tokens=80000 and max_generations=100;
  if not found then raise exception 'El presupuesto no coincide con la autorización original.'; end if;
end;
$baseline$;
select public.ecocleaner_llm_state();
`
}

async function main() {
  if (!process.argv.includes('--stop-local'))
    throw new Error(
      'Usa --stop-local para congelar el consumo antes de importarlo. No se generan respuestas.',
    )
  const outputIndex = process.argv.indexOf('--output')
  if (outputIndex < 0 || !process.argv[outputIndex + 1])
    throw new Error(
      'Indica --output con un archivo .sql fuera del repositorio.',
    )
  const origin = 'http://127.0.0.1:5173'
  const response = await fetch(origin + '/api/app/state', {
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok)
    throw new Error('No se pudo leer el estado del ejecutor local.')
  baselineSql(await response.json())
  const cookie = response.headers.get('set-cookie')?.split(';')[0]
  if (!cookie?.startsWith('ecocleaner_groq_local='))
    throw new Error('No se recibió la sesión local esperada.')
  const frozen = await fetch(origin + '/api/export-state', {
    method: 'POST',
    redirect: 'error',
    headers: {
      Origin: origin,
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(10000),
  })
  if (!frozen.ok)
    throw new Error(
      'No se pudo congelar el consumo. Comprueba que el ejecutor local utiliza el código de este PR y no tiene una consulta activa.',
    )
  const sql = baselineSql(await frozen.json())
  await writeFile(resolve(process.argv[outputIndex + 1]), sql, { flag: 'wx' })
  const stopped = await fetch(origin + '/api/stop', {
    method: 'POST',
    redirect: 'error',
    headers: {
      Origin: origin,
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: '{}',
    signal: AbortSignal.timeout(10000),
  })
  if (!stopped.ok)
    throw new Error(
      'No se confirmó la detención del ejecutor; no se exportó el presupuesto.',
    )
  console.log(
    'Ejecutor local detenido. SQL de importación escrito sin claves y sin generaciones nuevas. No iniciar otro ejecutor con ese mismo presupuesto.',
  )
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
