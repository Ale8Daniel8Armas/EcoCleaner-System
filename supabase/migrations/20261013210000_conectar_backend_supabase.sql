-- ==============================================================================
-- Migración: Conexión Backend Supabase, Políticas RLS y Semillas de Producción
-- EcoCleaner System
-- ==============================================================================

-- 1. Asegurar que las tablas tengan RLS habilitado y políticas permisivas
-- para anon y authenticated (permite que la app opere con el cliente configurado)

do $$
declare
  t text;
begin
  foreach t in array array [
    'sitios', 'areas', 'productos', 'tareas', 'variantes',
    'registros_uso', 'resultados', 'decisiones_efluente', 'usuarios'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    -- Eliminar políticas restrictivas previas si existen
    execute format('drop policy if exists "app_full_%s" on public.%I;', t, t);
    execute format('drop policy if exists "demo_all_%s" on public.%I;', t, t);
    execute format('drop policy if exists "catalogo_%s_select" on public.%I;', t, t);
    execute format('drop policy if exists "catalogo_%s_write" on public.%I;', t, t);
    execute format('drop policy if exists "%s_operario_insert" on public.%I;', t, t);
    execute format('drop policy if exists "%s_operario_select" on public.%I;', t, t);
    execute format('drop policy if exists "%s_revisor_update" on public.%I;', t, t);
    execute format('drop policy if exists "%s_select" on public.%I;', t, t);
    -- Crear política de acceso universal para la aplicación
    execute format(
      'create policy "app_full_%s" on public.%I for all to anon, authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end $$;

-- 2. Asegurar que las referencias de usuario permitan IDs de public.usuarios
alter table public.tareas drop constraint if exists tareas_operario_id_fkey;
alter table public.tareas drop constraint if exists tareas_revisor_id_fkey;
alter table public.registros_uso drop constraint if exists registros_uso_validado_por_fkey;

-- Asegurar que la tabla usuarios admita los tres roles ('operario', 'revisor', 'supervisor')
alter table public.usuarios drop constraint if exists usuarios_rol_check;
alter table public.usuarios add constraint usuarios_rol_check check (rol in ('operario', 'revisor', 'supervisor'));

-- Semilla de usuarios iniciales
insert into public.usuarios (id, email, username, password_hash, rol, nombre)
values
  ('db282b31-86f8-4388-92ac-53d0aef31136', 'operario@ecocleaner.com', 'operario', 'operario123', 'operario', 'Operario Principal'),
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'revisor@ecocleaner.com', 'revisor', 'revisor123', 'revisor', 'Revisor de Calidad'),
  ('b73b4a80-2c9f-4ef6-b59f-9ac3b6d0bfba', 'supervisor@ecocleaner.com', 'supervisor', 'supervisor123', 'supervisor', 'Supervisor de Planta')
on conflict (email) do update
set rol = excluded.rol,
    nombre = excluded.nombre,
    password_hash = excluded.password_hash;

-- 3. Semilla de Sitios
insert into public.sitios (id, nombre, tipo, criterios_limpieza)
values
  (
    '11111111-aaaa-4111-8111-111111111111',
    'Planta Norte - Procesamiento',
    'Planta Industrial',
    '["Ausencia de grasa visible", "Enjuague completo sin residuos químicos", "Prueba luminométrica ATP < 50 RLU"]'::jsonb
  ),
  (
    '22222222-bbbb-4222-8222-222222222222',
    'Centro de Distribución',
    'Logística',
    '["Pisos desengrasados y secos", "Sin polvo ni restos de embalaje", "Zonas de tránsito peatonal despejadas"]'::jsonb
  ),
  (
    '33333333-cccc-4333-8333-333333333333',
    'Laboratorio de Control',
    'Laboratorio',
    '["Desinfección de mesones", "Ausencia de agentes químicos residuales", "Superficies de acero esterilizadas"]'::jsonb
  )
on conflict (id) do update
set nombre = excluded.nombre, tipo = excluded.tipo, criterios_limpieza = excluded.criterios_limpieza;

-- 4. Semilla de Áreas
insert into public.areas (id, sitio_id, nombre, superficie_m2, tipo_superficie, litros_solucion_por_m2)
values
  ('aaaa1111-1111-4aaa-8aaa-aaaaaaaaaaaa', '11111111-aaaa-4111-8111-111111111111', 'Producción A', 120, 'Acero inoxidable', 0.4),
  ('aaaa2222-2222-4aaa-8aaa-aaaaaaaaaaaa', '11111111-aaaa-4111-8111-111111111111', 'Línea de Envasado', 85, 'Cintas transportadoras', 0.35),
  ('aaaa3333-3333-4aaa-8aaa-aaaaaaaaaaaa', '11111111-aaaa-4111-8111-111111111111', 'Cámara Fría', 60, 'Piso epóxico', 0.3),
  ('bbbb1111-1111-4bbb-8bbb-bbbbbbbbbbbb', '22222222-bbbb-4222-8222-222222222222', 'Muelles de carga', 250, 'Concreto pulido', 0.5),
  ('bbbb2222-2222-4bbb-8bbb-bbbbbbbbbbbb', '22222222-bbbb-4222-8222-222222222222', 'Baños y vestidores', 45, 'Cerámica', 0.4),
  ('cccc1111-1111-4ccc-8ccc-cccccccccccc', '33333333-cccc-4333-8333-333333333333', 'Mesones analíticos', 30, 'Granito sellado', 0.25)
on conflict (id) do update
set nombre = excluded.nombre, superficie_m2 = excluded.superficie_m2, tipo_superficie = excluded.tipo_superficie, litros_solucion_por_m2 = excluded.litros_solucion_por_m2;

-- 5. Semilla de Productos Químicos
insert into public.productos (
  id, nombre, tipo_quimico, categorias, incompatibilidades,
  dilucion_min_ml_por_litro, dilucion_ml_por_litro, dilucion_max_ml_por_litro,
  dilucion_texto_ficha, ph, concentracion_ph, ph_medido_a_ml_por_litro,
  indicaciones_disposicion
)
values
  (
    'd1111111-1111-4111-8111-111111111111',
    'Detergente alcalino clorado',
    'Alcalino clorado',
    '{"alcalino", "clorado"}',
    '{"acido"}',
    20, 50, 80,
    'Dosificación de 20 a 80 ml/L según nivel de suciedad orgánica',
    12.5, 'al 5%', 50,
    'Neutralizar el pH entre 6.0 y 9.0 antes de cualquier vertido al efluente'
  ),
  (
    'd2222222-2222-4222-8222-222222222222',
    'Desengrasante industrial Bio-Degraser',
    'Desengrasante biodegradable',
    '{"desengrasante", "solvente"}',
    '{"oxidante_fuerte"}',
    30, 60, 100,
    'Uso concentrado para grasas pesadas o dilución de 30-100 ml/L',
    10.5, 'al 10%', 60,
    'Apto para vertido regulado con dilución previa según normativa ambiental'
  ),
  (
    'd3333333-3333-4333-8333-333333333333',
    'Desinfectante amonio cuaternario 5G',
    'Amonio cuaternario de quinta generación',
    '{"desinfectante", "amonio_cuaternario"}',
    '{"anionico", "clorado"}',
    5, 15, 30,
    'Esterilización de contacto a 15 ml/L, no requiere enjuague en bajas dosis',
    7.2, 'al 2%', 15,
    'Efluente apto para reúso interno en prelavado de pisos no alimentarios'
  ),
  (
    'd4444444-4444-4444-8444-444444444444',
    'Limpiador ácido desincrustante',
    'Ácido fosfórico inhibido',
    '{"acido"}',
    '{"alcalino", "clorado"}',
    25, 40, 70,
    'Remoción de sarro y óxido mineral de 25 a 70 ml/L',
    2.1, 'al 5%', 40,
    '¡Peligro de emanación de cloro si se mezcla! Neutralizar o entregar a gestor autorizado'
  )
on conflict (id) do update
set nombre = excluded.nombre,
    dilucion_ml_por_litro = excluded.dilucion_ml_por_litro,
    dilucion_min_ml_por_litro = excluded.dilucion_min_ml_por_litro,
    dilucion_max_ml_por_litro = excluded.dilucion_max_ml_por_litro,
    ph = excluded.ph;

-- 6. Tareas iniciales de demostración en Supabase
-- Tarea 1: Pendiente de validación (para que el Revisor la vea en su bandeja)
insert into public.tareas (
  id, area_id, producto_id, nivel_suciedad, litros_solucion_esperados, ml_producto_esperados,
  estado, hora_inicio, tiempo_estimado_min, operario_id
)
values (
  'c1111111-1111-4111-8111-111111111111',
  'aaaa1111-1111-4aaa-8aaa-aaaaaaaaaaaa',
  'd1111111-1111-4111-8111-111111111111',
  'media',
  48,
  2400,
  'receta_enviada',
  now() - interval '45 minutes',
  30,
  'db282b31-86f8-4388-92ac-53d0aef31136'
) on conflict (id) do nothing;

insert into public.variantes (id, tarea_id, nombre, dilucion_ml_por_litro, repeticiones)
values (
  'f1111111-1111-4111-8111-111111111111',
  'c1111111-1111-4111-8111-111111111111',
  'Lavado de pisos y desagües',
  50,
  120
) on conflict (id) do nothing;

insert into public.registros_uso (
  id, tarea_id, variante_id, litros_agua_reales, ml_producto_reales, duracion_min,
  marca, fuente, alerta_sobredosis
)
values (
  'e1111111-1111-4111-8111-111111111111',
  'c1111111-1111-4111-8111-111111111111',
  'f1111111-1111-4111-8111-111111111111',
  46,
  2400,
  30,
  'medido',
  'manual',
  false
) on conflict (id) do nothing;

-- Tarea 2: Tarea validada y completada (para que el Supervisor vea consumo en su panel)
insert into public.tareas (
  id, area_id, producto_id, nivel_suciedad, litros_solucion_esperados, ml_producto_esperados,
  estado, hora_inicio, tiempo_estimado_min, operario_id, revisor_id, validada_en
)
values (
  'c2222222-2222-4222-8222-222222222222',
  'bbbb1111-1111-4bbb-8bbb-bbbbbbbbbbbb',
  'd2222222-2222-4222-8222-222222222222',
  'alta',
  125,
  7500,
  'completada',
  now() - interval '3 hours',
  60,
  'db282b31-86f8-4388-92ac-53d0aef31136',
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  now() - interval '2 hours'
) on conflict (id) do nothing;

insert into public.variantes (id, tarea_id, nombre, dilucion_ml_por_litro, repeticiones)
values (
  'f2222222-2222-4222-8222-222222222222',
  'c2222222-2222-4222-8222-222222222222',
  'Desengrase profundo de muelles',
  60,
  250
) on conflict (id) do nothing;

insert into public.registros_uso (
  id, tarea_id, variante_id, litros_agua_reales, ml_producto_reales, duracion_min,
  marca, fuente, alerta_sobredosis, validado_por, validado_en
)
values (
  'e2222222-2222-4222-8222-222222222222',
  'c2222222-2222-4222-8222-222222222222',
  'f2222222-2222-4222-8222-222222222222',
  120,
  7200,
  55,
  'medido',
  'manual',
  false,
  'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  now() - interval '2 hours'
) on conflict (id) do nothing;

insert into public.resultados (
  id, registro_uso_id, cumple_criterio, criterios_evaluados, observaciones
)
values (
  'a2222222-2222-4222-8222-222222222222',
  'e2222222-2222-4222-8222-222222222222',
  true,
  '[{"criterio": "Pisos desengrasados y secos", "cumple": true}, {"criterio": "Sin polvo ni restos de embalaje", "cumple": true}, {"criterio": "Zonas de tránsito peatonal despejadas", "cumple": true}]'::jsonb,
  'Área desengrasada conforme a los estándares de inspección de inocuidad.'
) on conflict (id) do nothing;

insert into public.decisiones_efluente (
  id, resultado_id, orientacion, decision_final, ph_estimado, observaciones
)
values (
  'b2222222-2222-4222-8222-222222222222',
  'a2222222-2222-4222-8222-222222222222',
  'verter',
  'verter',
  7.8,
  'Descarga autorizada tras verificación de pH dentro de norma ambiental 6.0 - 9.0'
) on conflict (id) do nothing;
