-- 1. Sitio
CREATE TABLE sitios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 2. Área
CREATE TABLE areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sitio_id UUID REFERENCES sitios(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    superficie_m2 NUMERIC NOT NULL,
    tipo_superficie TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 3. Producto
CREATE TABLE productos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    dilucion_ml_por_litro NUMERIC NOT NULL,
    -- CRITERIO: ml de producto por litro de solución
    ph NUMERIC,
    concentracion_ph TEXT,
    incompatibilidades TEXT [],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 4. Tarea
CREATE TABLE tareas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES productos(id),
    nivel_suciedad TEXT CHECK (nivel_suciedad IN ('baja', 'media', 'alta')),
    litros_solucion_esperados NUMERIC,
    ml_producto_esperados NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 5. Variante (Para la mini-prueba de 3x3)
CREATE TABLE variantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarea_id UUID REFERENCES tareas(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    dilucion_ml_por_litro NUMERIC NOT NULL,
    repeticiones INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 6. Registro de Uso
CREATE TABLE registros_uso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tarea_id UUID REFERENCES tareas(id) ON DELETE CASCADE,
    variante_id UUID REFERENCES variantes(id) ON DELETE
    SET NULL,
        litros_agua_reales NUMERIC NOT NULL,
        ml_producto_reales NUMERIC NOT NULL,
        marca TEXT CHECK (marca IN ('medido', 'estimado')) NOT NULL,
        -- CRITERIO: medido o estimado
        fuente TEXT CHECK (fuente IN ('manual', 'simulada', 'sensor')) NOT NULL,
        -- CRITERIO: manual, simulada o sensor
        alerta_sobredosis BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 7. Resultado
CREATE TABLE resultados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registro_uso_id UUID REFERENCES registros_uso(id) ON DELETE CASCADE UNIQUE,
    cumple_criterio BOOLEAN NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- 8. Decisión de Efluente
CREATE TABLE decisiones_efluente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resultado_id UUID REFERENCES resultados(id) ON DELETE CASCADE UNIQUE,
    orientacion TEXT CHECK (
        orientacion IN (
            'verter',
            'ajustar',
            'reutilizar',
            'gestor',
            'no_disponible'
        )
    ),
    decision_final TEXT NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);