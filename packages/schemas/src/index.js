import { z } from 'zod';
export const SitioSchema = z.object({
    id: z.string().uuid().optional(),
    nombre: z.string().min(2),
    tipo: z.string(),
});
export const AreaSchema = z.object({
    id: z.string().uuid().optional(),
    sitio_id: z.string().uuid(),
    nombre: z.string().min(2),
    superficie_m2: z.number().positive(),
    tipo_superficie: z.string(),
});
export const ProductoSchema = z.object({
    id: z.string().uuid().optional(),
    nombre: z.string().min(2),
    dilucion_ml_por_litro: z.number().positive(), // CRITERIO VALIDADO
    ph: z.number().min(0).max(14).nullable().optional(),
    concentracion_ph: z.string().nullable().optional(),
    incompatibilidades: z.array(z.string()).default([]),
});
export const TareaSchema = z.object({
    id: z.string().uuid().optional(),
    area_id: z.string().uuid(),
    producto_id: z.string().uuid(),
    nivel_suciedad: z.enum(['baja', 'media', 'alta']),
    litros_solucion_esperados: z.number().positive(),
    ml_producto_esperados: z.number().positive(),
});
export const VarianteSchema = z.object({
    id: z.string().uuid().optional(),
    tarea_id: z.string().uuid(),
    nombre: z.string(),
    dilucion_ml_por_litro: z.number().positive(),
    repeticiones: z.number().int().positive().default(1),
});
export const RegistroUsoSchema = z.object({
    id: z.string().uuid().optional(),
    tarea_id: z.string().uuid(),
    variante_id: z.string().uuid().optional(),
    litros_agua_reales: z.number().nonnegative(),
    ml_producto_reales: z.number().nonnegative(),
    marca: z.enum(['medido', 'estimado']), // CRITERIO VALIDADO
    fuente: z.enum(['manual', 'simulada', 'sensor']), // CRITERIO VALIDADO
    alerta_sobredosis: z.boolean().default(false),
});
export const ResultadoSchema = z.object({
    id: z.string().uuid().optional(),
    registro_uso_id: z.string().uuid(),
    cumple_criterio: z.boolean(),
    observaciones: z.string().optional(),
});
export const DecisionEfluenteSchema = z.object({
    id: z.string().uuid().optional(),
    resultado_id: z.string().uuid(),
    orientacion: z.enum(['verter', 'ajustar', 'reutilizar', 'gestor', 'no_disponible']).optional(),
    decision_final: z.string(),
    observaciones: z.string().optional(),
});
