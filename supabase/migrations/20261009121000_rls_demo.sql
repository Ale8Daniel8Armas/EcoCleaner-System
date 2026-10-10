do $$
declare t text;
begin foreach t in array array ['sitios','areas','productos','tareas','variantes',
                           'registros_uso','resultados','decisiones_efluente'] loop execute format(
    'alter table public.%I enable row level security',
    t
);
execute format(
    'create policy "demo_all_%s" on public.%I for all to anon, authenticated using (true) with check (true)',
    t,
    t
);
end loop;
end $$;