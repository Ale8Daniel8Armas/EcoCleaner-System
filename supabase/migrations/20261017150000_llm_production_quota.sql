-- Cuota compartida del asistente. No modifica tablas ni permisos del dominio.
create table public.ecocleaner_llm_pool (
  id text primary key check (id = 'production'),
  authorized_tokens bigint not null default 80000 check (authorized_tokens = 80000),
  used_tokens bigint not null default 80000 check (used_tokens >= 0),
  max_generations integer not null default 100 check (max_generations = 100),
  generations integer not null default 100 check (generations >= 0),
  provisioned boolean not null default false,
  active_request uuid,
  active_since timestamptz,
  halted boolean not null default false
);
insert into public.ecocleaner_llm_pool(id) values ('production');

create table public.ecocleaner_llm_requests (
  id uuid primary key,
  actor uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  reserved_tokens integer not null check (reserved_tokens > 0 and reserved_tokens <= 8000),
  charged_tokens integer not null check (charged_tokens > 0),
  fingerprint text not null check (length(fingerprint) = 64),
  question text not null check (length(question) between 1 and 700),
  result jsonb,
  telemetry jsonb,
  status text not null default 'reserved' check (status in ('reserved', 'completed', 'failed'))
);
create index ecocleaner_llm_requests_created on public.ecocleaner_llm_requests(created_at);
alter table public.ecocleaner_llm_pool enable row level security;
alter table public.ecocleaner_llm_requests enable row level security;
revoke all on public.ecocleaner_llm_pool, public.ecocleaner_llm_requests from public, anon, authenticated;
grant select, insert, update on public.ecocleaner_llm_pool, public.ecocleaner_llm_requests to service_role;

create function public.ecocleaner_llm_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'provider', 'groq', 'model', 'openai/gpt-oss-20b',
    'appDataApproved', provisioned, 'generations', generations,
    'maxGenerations', max_generations, 'usedTokenBudget', used_tokens,
    'authorizedTokenBudget', authorized_tokens, 'maxOutputTokens', 768,
    'minimumRequestTokenBudget', 1468,
    'busy', active_request is not null and active_since > now() - interval '2 minutes',
    'halted', case when halted then 'PROVIDER_REJECTED_SESSION'
                   when not provisioned then 'PRODUCTION_NOT_CONFIGURED' else null end
  ) from public.ecocleaner_llm_pool where id = 'production';
$$;

-- FOR UPDATE serializa las reservas entre instancias y arranques en frío.
-- Una reserva abandonada conserva todo su consumo; no se devuelve al vencer el bloqueo.
create function public.ecocleaner_llm_reserve(
  p_id uuid, p_actor uuid, p_tokens integer, p_fingerprint text, p_question text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pool public.ecocleaner_llm_pool%rowtype;
  minute_tokens bigint;
  minute_requests integer;
begin
  select * into strict pool from public.ecocleaner_llm_pool where id = 'production' for update;
  if not pool.provisioned then raise exception 'PRODUCTION_NOT_CONFIGURED'; end if;
  if pool.halted then raise exception 'PROVIDER_REJECTED_SESSION'; end if;
  if p_tokens is null or p_tokens < 1 or p_tokens > 8000 then raise exception 'INPUT_BUDGET'; end if;
  if pool.active_request is not null and pool.active_since > now() - interval '2 minutes'
    then raise exception 'BUSY'; end if;
  if pool.generations >= pool.max_generations then raise exception 'SESSION_LIMIT'; end if;
  if pool.used_tokens + p_tokens > pool.authorized_tokens then raise exception 'DAILY_TOKEN_BUDGET'; end if;
  select coalesce(sum(charged_tokens),0), count(*) into minute_tokens, minute_requests
    from public.ecocleaner_llm_requests where created_at > now() - interval '1 minute';
  if minute_requests >= 10 or minute_tokens + p_tokens > 8000 then raise exception 'LOCAL_MINUTE_BUDGET'; end if;
  insert into public.ecocleaner_llm_requests(id,actor,reserved_tokens,charged_tokens,fingerprint,question)
    values(p_id,p_actor,p_tokens,p_tokens,p_fingerprint,p_question);
  update public.ecocleaner_llm_pool set used_tokens = used_tokens + p_tokens,
    generations = generations + 1, active_request = p_id, active_since = now()
    where id = 'production';
  return public.ecocleaner_llm_state();
end;
$$;

create function public.ecocleaner_llm_finish(
  p_id uuid, p_usage integer, p_result jsonb, p_telemetry jsonb, p_halt boolean
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare request public.ecocleaner_llm_requests%rowtype;
begin
  perform 1 from public.ecocleaner_llm_pool where id = 'production' for update;
  select * into strict request from public.ecocleaner_llm_requests where id = p_id for update;
  if request.status <> 'reserved' then raise exception 'ALREADY_FINALIZED'; end if;
  -- Uso ausente o incoherente conserva la reserva completa.
  p_usage := case when p_usage is not null and p_usage > 0 then p_usage else request.reserved_tokens end;
  update public.ecocleaner_llm_requests set charged_tokens = p_usage, result = p_result,
    telemetry = p_telemetry, finished_at = now(),
    status = case when p_result->>'ok' = 'true' then 'completed' else 'failed' end where id = p_id;
  update public.ecocleaner_llm_pool set used_tokens = used_tokens + p_usage - request.reserved_tokens,
    halted = halted or coalesce(p_halt,false) or p_usage > request.reserved_tokens,
    active_request = case when active_request = p_id then null else active_request end,
    active_since = case when active_request = p_id then null else active_since end
    where id = 'production';
  return public.ecocleaner_llm_state();
end;
$$;

revoke all on function public.ecocleaner_llm_state() from public, anon, authenticated;
revoke all on function public.ecocleaner_llm_reserve(uuid,uuid,integer,text,text) from public, anon, authenticated;
revoke all on function public.ecocleaner_llm_finish(uuid,integer,jsonb,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.ecocleaner_llm_state() to service_role;
grant execute on function public.ecocleaner_llm_reserve(uuid,uuid,integer,text,text) to service_role;
grant execute on function public.ecocleaner_llm_finish(uuid,integer,jsonb,jsonb,boolean) to service_role;

-- Cerrado hasta importar UNA VEZ el consumo actualizado de la sesión local.
-- El procedimiento de activación se documenta en docs/groq-production.md.
