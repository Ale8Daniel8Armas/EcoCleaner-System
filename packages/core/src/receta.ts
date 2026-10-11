import type { NivelSuciedad, Producto } from '@ecocleaner/schemas'
import type { Receta } from './tipos'
import { esFinito, esObjeto, exigir, precisar } from './validacion'

/**
 * La dosis es ml de producto por litro de solución FINAL. El coeficiente por m²
 * llega documentado por el llamador; no se infieren factores de superficie.
 * Los niveles usan mínimo/recomendado/máximo, según las pruebas del contrato.
 * litros_agua = litros_solucion - ml_producto / 1000 (convención de volumen del proyecto).
 */
export function calcularReceta(e: {
    superficie_m2: number
    litros_solucion_por_m2: number
    nivel_suciedad: NivelSuciedad
    producto: Pick<Producto, 'dilucion_min_ml_por_litro' | 'dilucion_ml_por_litro' | 'dilucion_max_ml_por_litro'>
}): Receta {
    exigir(esObjeto(e), 'entrada', 'se requiere una entrada completa')
    exigir(esFinito(e.superficie_m2) && e.superficie_m2 > 0, 'superficie_m2', 'debe ser positiva y finita')
    exigir(esFinito(e.litros_solucion_por_m2) && e.litros_solucion_por_m2 > 0,
        'litros_solucion_por_m2', 'debe ser positivo y finito')
    exigir(['baja', 'media', 'alta'].includes(e.nivel_suciedad), 'nivel_suciedad', 'nivel desconocido')
    exigir(esObjeto(e.producto), 'producto', 'se requiere la dosificación documentada')

    const campos = ['dilucion_min_ml_por_litro', 'dilucion_ml_por_litro', 'dilucion_max_ml_por_litro'] as const
    for (const campo of campos) {
        const dosis = e.producto[campo]
        exigir(esFinito(dosis) && dosis > 0 && dosis <= 1000, `producto.${campo}`,
            'debe ser positiva, finita y no superar 1000 ml por litro de solución final')
    }
    const minimo = e.producto.dilucion_min_ml_por_litro
    const recomendada = e.producto.dilucion_ml_por_litro
    const maximo = e.producto.dilucion_max_ml_por_litro
    exigir(minimo <= recomendada && recomendada <= maximo, 'producto.dilucion_ml_por_litro',
        'debe estar dentro del rango documentado mínimo y máximo')
    const dosis = e.nivel_suciedad === 'baja' ? minimo : e.nivel_suciedad === 'alta' ? maximo : recomendada
    const litros = e.superficie_m2 * e.litros_solucion_por_m2
    const ml = litros * dosis
    exigir(esFinito(litros) && litros > 0 && esFinito(ml) && ml > 0,
        'resultado', 'los cálculos deben producir cantidades positivas y finitas')
    return {
        litros_solucion: precisar(litros),
        ml_por_litro: dosis,
        ml_producto: precisar(ml),
        litros_agua: precisar(litros * (1 - dosis / 1000)),
    }
}
