import { z } from 'zod';
export declare const SitioSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    nombre: z.ZodString;
    tipo: z.ZodString;
}, z.core.$strip>;
export declare const AreaSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    sitio_id: z.ZodString;
    nombre: z.ZodString;
    superficie_m2: z.ZodNumber;
    tipo_superficie: z.ZodString;
}, z.core.$strip>;
export declare const ProductoSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    nombre: z.ZodString;
    dilucion_ml_por_litro: z.ZodNumber;
    ph: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    concentracion_ph: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    incompatibilidades: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export declare const TareaSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    area_id: z.ZodString;
    producto_id: z.ZodString;
    nivel_suciedad: z.ZodEnum<{
        baja: "baja";
        media: "media";
        alta: "alta";
    }>;
    litros_solucion_esperados: z.ZodNumber;
    ml_producto_esperados: z.ZodNumber;
}, z.core.$strip>;
export declare const VarianteSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    tarea_id: z.ZodString;
    nombre: z.ZodString;
    dilucion_ml_por_litro: z.ZodNumber;
    repeticiones: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const RegistroUsoSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    tarea_id: z.ZodString;
    variante_id: z.ZodOptional<z.ZodString>;
    litros_agua_reales: z.ZodNumber;
    ml_producto_reales: z.ZodNumber;
    marca: z.ZodEnum<{
        medido: "medido";
        estimado: "estimado";
    }>;
    fuente: z.ZodEnum<{
        manual: "manual";
        simulada: "simulada";
        sensor: "sensor";
    }>;
    alerta_sobredosis: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const ResultadoSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    registro_uso_id: z.ZodString;
    cumple_criterio: z.ZodBoolean;
    observaciones: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const DecisionEfluenteSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    resultado_id: z.ZodString;
    orientacion: z.ZodOptional<z.ZodEnum<{
        verter: "verter";
        ajustar: "ajustar";
        reutilizar: "reutilizar";
        gestor: "gestor";
        no_disponible: "no_disponible";
    }>>;
    decision_final: z.ZodString;
    observaciones: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type Sitio = z.infer<typeof SitioSchema>;
export type Area = z.infer<typeof AreaSchema>;
export type Producto = z.infer<typeof ProductoSchema>;
export type Tarea = z.infer<typeof TareaSchema>;
export type Variante = z.infer<typeof VarianteSchema>;
export type RegistroUso = z.infer<typeof RegistroUsoSchema>;
export type Resultado = z.infer<typeof ResultadoSchema>;
export type DecisionEfluente = z.infer<typeof DecisionEfluenteSchema>;
