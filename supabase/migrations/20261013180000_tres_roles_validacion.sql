-- ==============================================================================
-- Migración: Tres roles jerárquicos (operario, revisor, supervisor) y validación
-- ==============================================================================

-- 1. Tabla de perfiles vinculada a auth.users
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    nombre text not null,
    rol text not null check (rol in ('operario', 'revisor', 'supervisor')),
    created_at timestamptz not null default now()
);

-- Evitar que usuarios normales modifiquen su propio rol
create or replace function public.prevenir_cambio_rol()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.rol <> old.rol and (select public.obtener_rol_actual()) <> 'supervisor' then
        raise exception 'No está permitido modificar el propio rol de usuario';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_prevenir_cambio_rol on public.profiles;
create trigger trg_prevenir_cambio_rol
before update on public.profiles
for each row
execute function public.prevenir_cambio_rol();

-- 2. Modificaciones a la tabla tareas
alter table public.tareas
    add column if not exists estado text not null default 'receta_enviada' check (estado in ('receta_enviada', 'completada')),
    add column if not exists hora_inicio timestamptz not null default now(),
    add column if not exists tiempo_estimado_min integer not null default 30 check (tiempo_estimado_min > 0),
    add column if not exists operario_id uuid references auth.users(id),
    add column if not exists revisor_id uuid references auth.users(id),
    add column if not exists validada_en timestamptz;

-- 3. Modificaciones a la tabla registros_uso
alter table public.registros_uso
    add column if not exists validado_por uuid references auth.users(id),
    add column if not exists validado_en timestamptz,
    add column if not exists declarado_operario jsonb;

-- 4. Función auxiliar security definer para leer el rol desde profiles
create or replace function public.obtener_rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select rol from public.profiles where id = auth.uid();
$$;

-- 5. Eliminar políticas de demostración anteriores
drop policy if exists "demo_all_sitios" on public.sitios;
drop policy if exists "demo_all_areas" on public.areas;
drop policy if exists "demo_all_productos" on public.productos;
drop policy if exists "demo_all_tareas" on public.tareas;
drop policy if exists "demo_all_variantes" on public.variantes;
drop policy if exists "demo_all_registros_uso" on public.registros_uso;
drop policy if exists "demo_all_resultados" on public.resultados;
drop policy if exists "demo_all_decisiones_efluente" on public.decisiones_efluente;

-- 6. Políticas RLS por rol (sin acceso para usuarios anónimos)

-- Catálogo: sitios, areas, productos, variantes
-- Lectura: cualquier usuario autenticado; Escritura: solo supervisor
create policy "catalogo_sitios_select" on public.sitios
    for select to authenticated using (true);
create policy "catalogo_sitios_write" on public.sitios
    for all to authenticated using (public.obtener_rol_actual() = 'supervisor')
    with check (public.obtener_rol_actual() = 'supervisor');

create policy "catalogo_areas_select" on public.areas
    for select to authenticated using (true);
create policy "catalogo_areas_write" on public.areas
    for all to authenticated using (public.obtener_rol_actual() = 'supervisor')
    with check (public.obtener_rol_actual() = 'supervisor');

create policy "catalogo_productos_select" on public.productos
    for select to authenticated using (true);
create policy "catalogo_productos_write" on public.productos
    for all to authenticated using (public.obtener_rol_actual() = 'supervisor')
    with check (public.obtener_rol_actual() = 'supervisor');

create policy "catalogo_variantes_select" on public.variantes
    for select to authenticated using (true);
create policy "catalogo_variantes_write" on public.variantes
    for all to authenticated using (public.obtener_rol_actual() = 'supervisor')
    with check (public.obtener_rol_actual() = 'supervisor');

-- Tareas
-- Operario: inserta y lee las suyas
-- Revisor: lee todas y actualiza
-- Supervisor: lee todas
create policy "tareas_operario_insert" on public.tareas
    for insert to authenticated
    with check (
        public.obtener_rol_actual() = 'operario'
        and (operario_id is null or operario_id = auth.uid())
    );

create policy "tareas_operario_select" on public.tareas
    for select to authenticated
    using (
        (public.obtener_rol_actual() = 'operario' and operario_id = auth.uid())
        or public.obtener_rol_actual() in ('revisor', 'supervisor')
    );

create policy "tareas_revisor_update" on public.tareas
    for update to authenticated
    using (public.obtener_rol_actual() = 'revisor')
    with check (public.obtener_rol_actual() = 'revisor');

-- Registros de uso
create policy "registros_uso_operario_insert" on public.registros_uso
    for insert to authenticated
    with check (
        public.obtener_rol_actual() in ('operario', 'revisor')
        and exists (
            select 1 from public.tareas t
            where t.id = tarea_id
            and (t.operario_id = auth.uid() or public.obtener_rol_actual() = 'revisor')
        )
    );

create policy "registros_uso_select" on public.registros_uso
    for select to authenticated
    using (
        (public.obtener_rol_actual() = 'operario' and exists (
            select 1 from public.tareas t where t.id = tarea_id and t.operario_id = auth.uid()
        ))
        or public.obtener_rol_actual() in ('revisor', 'supervisor')
    );

create policy "registros_uso_revisor_update" on public.registros_uso
    for update to authenticated
    using (public.obtener_rol_actual() = 'revisor')
    with check (public.obtener_rol_actual() = 'revisor');

-- Resultados
create policy "resultados_operario_insert" on public.resultados
    for insert to authenticated
    with check (
        public.obtener_rol_actual() in ('operario', 'revisor')
        and exists (
            select 1 from public.registros_uso r
            join public.tareas t on t.id = r.tarea_id
            where r.id = registro_uso_id
            and (t.operario_id = auth.uid() or public.obtener_rol_actual() = 'revisor')
        )
    );

create policy "resultados_select" on public.resultados
    for select to authenticated
    using (
        (public.obtener_rol_actual() = 'operario' and exists (
            select 1 from public.registros_uso r
            join public.tareas t on t.id = r.tarea_id
            where r.id = registro_uso_id and t.operario_id = auth.uid()
        ))
        or public.obtener_rol_actual() in ('revisor', 'supervisor')
    );

create policy "resultados_revisor_update" on public.resultados
    for update to authenticated
    using (public.obtener_rol_actual() = 'revisor')
    with check (public.obtener_rol_actual() = 'revisor');

-- Decisiones de efluente
create policy "decisiones_operario_insert" on public.decisiones_efluente
    for insert to authenticated
    with check (
        public.obtener_rol_actual() in ('operario', 'revisor')
        and exists (
            select 1 from public.resultados res
            join public.registros_uso r on r.id = res.registro_uso_id
            join public.tareas t on t.id = r.tarea_id
            where res.id = resultado_id
            and (t.operario_id = auth.uid() or public.obtener_rol_actual() = 'revisor')
        )
    );

create policy "decisiones_select" on public.decisiones_efluente
    for select to authenticated
    using (
        (public.obtener_rol_actual() = 'operario' and exists (
            select 1 from public.resultados res
            join public.registros_uso r on r.id = res.registro_uso_id
            join public.tareas t on t.id = r.tarea_id
            where res.id = resultado_id and t.operario_id = auth.uid()
        ))
        or public.obtener_rol_actual() in ('revisor', 'supervisor')
    );

create policy "decisiones_revisor_update" on public.decisiones_efluente
    for update to authenticated
    using (public.obtener_rol_actual() = 'revisor')
    with check (public.obtener_rol_actual() = 'revisor');

-- Profiles
create policy "profiles_select_own" on public.profiles
    for select to authenticated
    using (
        id = auth.uid()
        or public.obtener_rol_actual() = 'supervisor'
    );

create policy "profiles_update_own" on public.profiles
    for update to authenticated
    using (
        id = auth.uid()
        or public.obtener_rol_actual() = 'supervisor'
    )
    with check (
        id = auth.uid()
        or public.obtener_rol_actual() = 'supervisor'
    );

-- 7. Función RPC transaccional para validación por el Revisor
create or replace function public.validar_tarea_transaccional(
    p_tarea_id uuid,
    p_litros_agua numeric,
    p_ml_producto numeric,
    p_marca text,
    p_fuente text,
    p_declarado_original jsonb,
    p_cumple_criterio boolean,
    p_criterios_evaluados jsonb,
    p_observaciones_resultado text,
    p_orientacion text,
    p_decision_final text,
    p_ph_estimado numeric,
    p_observaciones_efluente text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_revisor_id uuid := auth.uid();
    v_now timestamptz := now();
    v_reg_id uuid;
    v_res_id uuid;
    v_dec_id uuid;
begin
    -- 1. Actualizar o insertar registro_uso con las cantidades validadas
    select id into v_reg_id from public.registros_uso where tarea_id = p_tarea_id limit 1;
    if v_reg_id is not null then
        update public.registros_uso
        set litros_agua_reales = p_litros_agua,
            ml_producto_reales = p_ml_producto,
            marca = p_marca,
            fuente = p_fuente,
            validado_por = v_revisor_id,
            validado_en = v_now,
            declarado_operario = p_declarado_original
        where id = v_reg_id;
    else
        insert into public.registros_uso (
            tarea_id, litros_agua_reales, ml_producto_reales, marca, fuente,
            validado_por, validado_en, declarado_operario
        ) values (
            p_tarea_id, p_litros_agua, p_ml_producto, p_marca, p_fuente,
            v_revisor_id, v_now, p_declarado_original
        ) returning id into v_reg_id;
    end if;

    -- 2. Upsert resultado de limpieza
    insert into public.resultados (
        registro_uso_id, cumple_criterio, criterios_evaluados, observaciones
    ) values (
        v_reg_id, p_cumple_criterio, p_criterios_evaluados, p_observaciones_resultado
    )
    on conflict (registro_uso_id) do update
    set cumple_criterio = excluded.cumple_criterio,
        criterios_evaluados = excluded.criterios_evaluados,
        observaciones = excluded.observaciones
    returning id into v_res_id;

    -- 3. Upsert decisión de efluente
    insert into public.decisiones_efluente (
        resultado_id, orientacion, decision_final, ph_estimado, observaciones
    ) values (
        v_res_id, p_orientacion, p_decision_final, p_ph_estimado, p_observaciones_efluente
    )
    on conflict (resultado_id) do update
    set orientacion = excluded.orientacion,
        decision_final = excluded.decision_final,
        ph_estimado = excluded.ph_estimado,
        observaciones = excluded.observaciones
    returning id into v_dec_id;

    -- 4. Marcar la tarea como completada
    update public.tareas
    set estado = 'completada',
        revisor_id = v_revisor_id,
        validada_en = v_now
    where id = p_tarea_id;

    return jsonb_build_object(
        'tarea_id', p_tarea_id,
        'registro_id', v_reg_id,
        'resultado_id', v_res_id,
        'decision_id', v_dec_id,
        'estado', 'completada',
        'validada_en', v_now
    );
end;
$$;
