begin;
-- productos
alter table productos
add column dilucion_min_ml_por_litro numeric,
    add column dilucion_max_ml_por_litro numeric,
    add column dilucion_texto_ficha text,
    add column tipo_quimico text,
    add column categorias text [] not null default '{}',
    add column ph_medido_a_ml_por_litro numeric,
    add column indicaciones_disposicion text,
    add column url_ficha_tecnica text,
    add column url_hoja_seguridad text;
update productos
set incompatibilidades = '{}'
where incompatibilidades is null;
alter table productos
alter column incompatibilidades
set default '{}',
    alter column incompatibilidades
set not null,
    alter column dilucion_min_ml_por_litro
set not null,
    alter column dilucion_max_ml_por_litro
set not null;
alter table productos
add constraint productos_dilucion_rango_chk check (
        dilucion_min_ml_por_litro > 0
        and dilucion_min_ml_por_litro <= dilucion_ml_por_litro
        and dilucion_ml_por_litro <= dilucion_max_ml_por_litro
    ),
    add constraint productos_ph_chk check (
        ph is null
        or ph between 0 and 14
    );
comment on column productos.dilucion_ml_por_litro is 'Valor recomendado de la ficha, en ml de producto por litro de solución final';
comment on column productos.incompatibilidades is 'Categorías con las que no debe mezclarse';
-- sitios y áreas
alter table sitios
add column criterios_limpieza jsonb not null default '[]'::jsonb;
alter table areas
add column litros_solucion_por_m2 numeric;
alter table areas
alter column sitio_id
set not null;
alter table areas
add constraint areas_superficie_chk check (superficie_m2 > 0),
    add constraint areas_litros_m2_chk check (
        litros_solucion_por_m2 is null
        or litros_solucion_por_m2 > 0
    );
-- tareas y variantes
alter table tareas
alter column area_id
set not null,
    alter column producto_id
set not null,
    alter column litros_solucion_esperados
set not null,
    alter column ml_producto_esperados
set not null,
    add constraint tareas_esperados_chk check (
        litros_solucion_esperados > 0
        and ml_producto_esperados > 0
    );
alter table variantes
add constraint variantes_dilucion_chk check (dilucion_ml_por_litro > 0);
comment on column variantes.repeticiones is 'Repeticiones planificadas; las reales se cuentan en registros_uso';
-- registros, resultados y decisiones
alter table registros_uso
add column duracion_min numeric;
alter table registros_uso
alter column tarea_id
set not null;
alter table registros_uso
add constraint registros_agua_chk check (litros_agua_reales > 0),
    add constraint registros_producto_chk check (ml_producto_reales >= 0);
alter table resultados
add column criterios_evaluados jsonb;
alter table decisiones_efluente
add column ph_estimado numeric;
alter table decisiones_efluente
alter column orientacion
set not null;
alter table decisiones_efluente
add constraint decision_final_chk check (
        decision_final in ('verter', 'ajustar', 'reutilizar', 'gestor')
    ),
    add constraint decision_ph_chk check (
        ph_estimado is null
        or ph_estimado between 0 and 14
    );
-- índices
create index on areas (sitio_id);
create index on tareas (area_id);
create index on variantes (tarea_id);
create index on registros_uso (tarea_id);
create index on registros_uso (variante_id);
commit;