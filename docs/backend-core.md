# Backend y dominio P0

Las cuatro funciones son puras y no requieren React, Supabase ni red.
Los esquemas compartidos y las migraciones no se modifican. Las extensiones
indicadas a continuación son opcionales y locales al contrato de core.

## Receta

`calcularReceta` utiliza los coeficientes del contrato vigente. El llamador
selecciona `litros_solucion_por_m2` para la superficie: la función no recibe
`tipo_superficie` ni inventa factores. Según la regla ya descrita en las pruebas,
suciedad baja usa la dosis mínima, media la recomendada y alta la máxima.

La dosis está expresada en ml de producto por litro de solución **final**.
`litros_solucion = superficie_m2 * litros_solucion_por_m2` y
`ml_producto = litros_solucion * dosis`. Bajo la convención volumétrica del
proyecto, `litros_agua = litros_solucion - ml_producto / 1000`.
No se modelan contracciones de volumen ni fenómenos químicos.

Los valores deben ser finitos y positivos; mínimo, recomendado y máximo deben
estar ordenados. Más de 1000 ml de producto por litro final es dimensionalmente
inconsistente. Los errores exponen `ErrorValidacionCore`, `codigo` y `campo`.
El redondeo usa 15 cifras significativas, conserva cantidades pequeñas y evita
crear infinitos al redondear valores extremos finitos.

## Comparación

La política existente en `pendientes.test.ts` prioriza **producto promedio**.
El agua se informa por separado. Un empate se devuelve sin recomendación;
no se inventan ponderaciones ni un criterio de desempate.

El llamador debe agrupar variantes de la misma tarea con condiciones equivalentes.
Los registros admiten `marca` y `fuente`, con los mismos valores del esquema
compartido. Las llamadas originales sin estos campos siguen aceptándose, pero
no respaldan una recomendación de datos medidos. Los estimados y simulados se
cuentan por separado; no se mezclan con los promedios medidos para recomendar.
Sin mediciones, los promedios visibles se etiquetan como provisionales.

El mínimo por defecto es dos observaciones medidas no simuladas, configurable
con `min_repeticiones`. Es una barrera operativa, no evidencia estadística.
Un incumplimiento conocido o un resultado de limpieza incompleto excluye la
variante. Se muestran los conteos de registros válidos e inválidos y los motivos.

## Incompatibilidades

La llamada original devuelve coincidencias del catálogo. Una lista vacía **no**
certifica compatibilidad. Para conocer datos faltantes, usar
`detectarIncompatibilidades(productos, { detallado: true })`.

El informe expone estado, conflictos y datos insuficientes. Cada coincidencia
identifica el producto que contiene la regla, el campo y la hoja de seguridad
si fue suministrada; no se inventa una fuente ausente. `compatibilidad_demostrada`
es siempre `false`. No hay inferencias por nombres comerciales ni reacciones
generadas. Las reglas y categorías deben ser revisadas al cargar el catálogo.

## Efluentes

El pH del producto a una dilución dada no es el pH del efluente. Sin medición
final o fundamento documental conservador, se devuelve `no_disponible`.
`ph_estimado` permanece en `null`: no hay un modelo validado en el repositorio.
El resultado identifica `ph_efluente` y `origen_ph` por separado.

La entrada admite opcionalmente:

- `medicion_ph_efluente`: valor medido y fuente.
- `validacion_rango`: fuente, jurisdicción, verificación y aplicabilidad.
- `regla_disposicion`: orientación, fuente, verificación, aplicabilidad y
  revisión de criterios adicionales al pH cuando corresponda.

No basta con que el pH esté en rango. Para orientar vertido se necesitan además
una regla revisada y los demás criterios verificados. El reúso exige su propia
regla aplicable y permiso técnico; no se deduce del rango de descarga. Un pH
medido fuera de un rango verificado lleva a evaluación técnica, sin prescribir
neutralización. Los sobrantes concentrados reciben una orientación conservadora
hacia un gestor autorizado. `requiere_revision` es siempre `true` y
`autoriza_vertido` siempre `false`.

Los límites de los tests son ficticios, sin validez normativa. El responsable
técnico debe revisar las fuentes y los criterios antes de usar datos reales.

## Verificación local

Desde la raíz, instalar solo si es necesario mediante `npm ci`, compilar schemas
con `npm run build --workspace @ecocleaner/schemas` y ejecutar
`npm test --workspace @ecocleaner/core`.

Core no tiene scripts propios de build ni de lint. Los tipos pueden comprobarse
con el compilador TypeScript ya declarado, usando `--noEmit --strict`, módulos
ESNext, resolución bundler, objetivo ES2022 y `--erasableSyntaxOnly`.
El lint existente de web admite la ruta absoluta de `packages/core/src`.

Todos los fixtures y fuentes de prueba son ficticios. Los tests validan lógica
de software, no seguridad química ni ahorro real. Las tres pruebas TODO de
`calcularDesvio` permanecen pendientes porque esa función no pertenece a estas
tres tarjetas. La antigua expectativa de estimar pH para ajustar fue convertida
en una prueba de pH **medido** y rango verificado, conforme a la misión actual.

Antes de integrar, revisar con el líder las extensiones de core, la procedencia
en comparación y la carga de reglas ambientales documentadas. La aplicación
web existente compila, pero todavía no constituye una prueba del flujo completo
de las interfaces con estas funciones.
