# Especificación de Requisitos de Software (ERS)
## EcoCleaner: optimización del uso de agua y químicos en la limpieza industrial

| Campo | Detalle |
|---|---|
| Versión y fecha | 1.0 - 10 de octubre de 2026 |
| Evento | Hackatón Expo Clean 2026 - Reto 4 |
| Reto | Optimización y neutralización del impacto ambiental, en el uso de agua y vertido de residuos químicos |
| Equipo | EcoCleaner (5 integrantes) |
| Tipo de producto | Prototipo funcional: aplicación web móvil (PWA) con base de datos |
| Destinatarios | Equipo de desarrollo (backend y frontend), QA y datos, y revisión del comité |

**Versión 1.0 · 10 de octubre de 2026 · Borrador para desarrollo**

---

# 1. Introducción

## 1.1 Propósito

Este documento define qué debe hacer EcoCleaner y cómo se construirá su prototipo. Sirve como referencia común para backend, frontend, QA y datos, y como base de los criterios de aceptación.

## 1.2 Alcance

EcoCleaner es una aplicación web móvil para empresas de limpieza industrial. Ayuda a preparar la mezcla correcta, registrar lo que realmente se usa, comprobar si la limpieza cumplió su criterio, recomendar el procedimiento de menor consumo que sí funciona y orientar qué hacer con el efluente. Funciona desde el primer día con registros manuales, sin sensores propios.

El alcance inicial es el lavado de pisos y superficies industriales no críticas (bodegas, almacenes logísticos y zonas de tránsito de plantas). No cubre superficies donde la eficacia sanitaria es crítica, como las de hospitales, porque reducir la dosis allí podría comprometer el control de infecciones.

## 1.3 Problema y objetivo

En la limpieza industrial el agua y los productos químicos suelen usarse sin medir: las soluciones se preparan «a ojo» y casi nunca se registra cuánto se usó ni si la limpieza cumplió su objetivo. Esa es nuestra hipótesis de trabajo y se contrasta con entrevistas a usuarios. El objetivo es reducir el consumo evitable en origen sin perder calidad, y dar trazabilidad y orientación sobre el efluente. No se prometen porcentajes de ahorro: se medirán en una prueba controlada propia (3 variantes por 3 repeticiones), declarada como muestra pequeña.

## 1.4 Relación con el reto

| Elemento del reto | Cómo lo atiende EcoCleaner |
|---|---|
| Optimizar | Receta con dilución dentro del rango de la ficha y recomendación del procedimiento de menor consumo que cumple el criterio de limpieza. |
| Neutralizar el impacto | Menos carga química en origen, alertas de sobredosis y de mezclas incompatibles, guía de efluente (verter, ajustar, reutilizar o gestor autorizado) y trazabilidad. El software no neutraliza físicamente el efluente: orienta, previene y documenta. |
| Uso de agua | Registro de litros por tarea y área, comparación con la receta y con variantes. |
| Vertido de químicos | Estimación de pH desde la ficha, decisión de efluente registrada y reporte por sitio y periodo. |

## 1.5 Definiciones

| Término | Significado |
|---|---|
| Ficha técnica (TDS) | Documento del fabricante con modo de uso y dilución recomendada. |
| Hoja de datos de seguridad (HDS o SDS) | Documento de 16 secciones. Se usan la 9 (pH), la 10 (incompatibilidades) y la 13 (disposición). |
| ml/L | Mililitros de producto por litro de solución final. Es la única convención de dilución del sistema. |
| Receta | Litros de solución, litros de agua y ml de producto calculados para una tarea. |
| Variante | Procedimiento alternativo (por ejemplo, otra dilución) que se compara en la mini-prueba. |
| Efluente | Agua residual con producto que resulta de la limpieza. |
| Medido / estimado | Marca que indica si el operario midió el dato o lo estimó. |
| PWA | Aplicación web instalable con diseño móvil primero. |
| RLS | Seguridad por filas de la base de datos (Row Level Security). |

# 2. Descripción general

## 2.1 Usuarios

| Perfil | Qué hace | Dispositivo |
|---|---|---|
| Operario | Consulta la receta, registra consumo y resultado de limpieza y revisa la guía de efluente. | Celular, en terreno |
| Supervisor | Crea sitios y áreas, define criterios de limpieza, revisa panel y comparación de variantes y genera el reporte. | Celular o computador |
| Cliente (fuera del sistema) | Recibe el reporte impreso o en PDF. En el prototipo no accede a la aplicación. | No aplica |

## 2.2 Flujo principal

**Receta → registro de uso → resultado de limpieza → comparación de variantes y recomendación → guía de efluente → panel y reporte.**

## 2.3 Restricciones y supuestos

- El registro de consumo es autodeclarado por el operario. Se reduce la fricción con selectores y se distingue medido de estimado.
- No hay inicio de sesión real en el prototipo: un selector de rol permite entrar como operario o supervisor.
- Los datos simulados se rotulan como tales (fuente «simulada») y no se usan como evidencia de ahorro.
- Los litros de solución por m² no los da la ficha: se calibran con la mini-prueba y mientras tanto son un supuesto editable.
- El catálogo del prototipo tiene 6 productos con ficha técnica y hoja de seguridad reales.
- La IA es opcional (P1) y nunca está en el camino crítico.

## 2.4 Fuera de alcance

- Sensores reales de caudal o pH, y dosificadores automáticos.
- Neutralización física del efluente y certificación de ahorros.
- Autenticación real y políticas de seguridad por usuario.
- Aplicación nativa, modo sin conexión, foto con IA e integración con WhatsApp (hoja de ruta).

# 3. Requisitos funcionales

Prioridades: **P0** es obligatorio y debe funcionar de punta a punta; **P1** solo entra si el P0 está estable.

| ID | Requisito | Criterio de aceptación | Prior. |
|---|---|---|---|
| RF-01 | Crear un sitio desde una plantilla por tipo de lugar, con áreas editables (nombre, superficie en m², tipo de superficie y litros de solución por m²) y criterios de limpieza. | Un sitio con sus áreas se crea en menos de 2 minutos. | P0 |
| RF-02 | Consultar el catálogo de productos y cargarlo desde un JSON validado contra el esquema. | Los 6 productos cargan sin errores y cada uno enlaza a su ficha técnica y a su hoja de seguridad. | P0 |
| RF-03 | Calcular la receta según m², litros por m², nivel de suciedad y rango de dilución del producto. | Un ejemplo conocido da los litros y ml esperados; nunca sale del rango de la ficha. | P0 |
| RF-04 | Registrar el uso: litros de agua, ml de producto, duración, marca medido o estimado y fuente. | El registro se guarda en la base de datos con selectores, sin texto libre para cantidades. | P0 |
| RF-05 | Alertar de sobredosis frente a la receta y cuando se supere el máximo de la ficha. | La alerta aparece al registrar y queda guardada en el registro. | P0 |
| RF-06 | Alertar de mezclas incompatibles entre los productos usados en una tarea. | Hipoclorito con ácido se detecta en ambos sentidos. | P0 |
| RF-07 | Evaluar el criterio de limpieza con un checklist de cumple o no cumple definido por el supervisor. | El resultado cumple solo si todos los criterios cumplen y queda vinculado al registro. | P0 |
| RF-08 | Comparar variantes: descartar las que no cumplen y recomendar la de menor consumo observado, con su tamaño de muestra. | Una variante más barata que no limpió se descarta y se explica el motivo. | P0 |
| RF-09 | Guiar la decisión de efluente (verter, ajustar, reutilizar, gestor o no disponible) y registrar la decisión final. | La orientación aparece al terminar la tarea y la decisión queda guardada con el pH estimado. | P0 |
| RF-10 | Panel del supervisor con litros y ml por área y tarea frente a la receta, desvíos y áreas con consumo atípico. | El panel muestra datos reales de la base y marca las áreas atípicas. | P0 |
| RF-11 | Reporte imprimible por sitio y periodo con consumo, resultados y decisiones de efluente. | El reporte se imprime a PDF desde el navegador con formato legible. | P0 |
| RF-12 | Selector de rol (operario o supervisor) sin inicio de sesión, con navegación distinta por rol. | Cada rol ve solo sus pantallas en la barra inferior. | P0 |
| RF-13 | Simulador de fuga o sobreconsumo, generado en el navegador, para la demostración en vivo. | Los datos generados se guardan con fuente «simulada» y se rotulan en pantalla. | P1 |
| RF-14 | Abrir un área mediante código QR. | Un QR abre la receta del área correcta; sin QR se elige de una lista. | P1 |
| RF-15 | Explicador con LLM: redacta en lenguaje simple resultados ya calculados y responde preguntas del supervisor con los datos recibidos. | Si falla o tarda, se muestra un texto plantilla; nunca calcula ni emite alertas de seguridad. | P1 |

# 4. Requisitos no funcionales

| ID | Requisito | Criterio |
|---|---|---|
| RNF-01 | Usabilidad móvil: diseño móvil primero, botones de al menos 44 px, sin desplazamiento horizontal, estados de carga y error. | Probado en al menos 2 celulares reales. |
| RNF-02 | Seguridad del dominio: nunca recomendar una dilución fuera del rango de la ficha. | Validado en el código (core) y con restricciones en la base. |
| RNF-03 | Seguridad de claves: la clave del LLM vive solo en el servidor; la clave service_role no se usa ni se sube; los archivos .env no se versionan. | Revisión del repositorio antes de cada merge. |
| RNF-04 | Seguridad de datos del prototipo: RLS activado con políticas de demostración abiertas. Es una limitación declarada, no seguridad de producción. | Documentada en el README y la hoja de ruta. |
| RNF-05 | Fiabilidad: el LLM está fuera del camino crítico y existe un texto plantilla de respaldo. | La demo funciona con el LLM desactivado. |
| RNF-06 | Trazabilidad: cada registro lleva marca (medido o estimado) y fuente (manual, simulada o sensor). | Campos obligatorios en la base y en el esquema. |
| RNF-07 | Mantenibilidad: monorepo, lógica de negocio pura y probada en `packages/core`, tipos derivados de los esquemas Zod. | CI en verde en cada pull request. |
| RNF-08 | Rendimiento: carga inicial ágil en conexión móvil típica e imágenes comprimidas. | Objetivo de equipo: menos de 3 s en 4G, verificado con Lighthouse. |
| RNF-09 | Portabilidad: PWA instalable en navegadores móviles actuales. | Se ofrece instalar la app en el celular. |
| RNF-10 | Idioma: interfaz y documentación en español. | Revisión de textos antes del evento. |

# 5. Reglas de negocio y cálculo

Las reglas RN-05 a RN-08 incluyen parámetros propuestos por el equipo que deben acordarse (sección 10.3).

| ID | Regla |
|---|---|
| RN-01 | Convención de dilución: ml de producto por litro de solución final. Se convierte desde la notación de cada fabricante (por ejemplo, 1:20) y se guarda el texto original. |
| RN-02 | `litros_solucion = superficie_m2 × litros_solucion_por_m2`. |
| RN-03 | Concentración según suciedad: baja usa el mínimo de la ficha, media usa el recomendado y alta usa el máximo. |
| RN-04 | `ml_producto = litros_solucion × ml_por_litro`. `litros_agua = litros_solucion - ml_producto ÷ 1000`. Ejemplo: 10 L a 50 ml/L dan 500 ml de producto y 9,5 L de agua. |
| RN-05 | Desvío: la concentración real es `ml_reales ÷ (litros_agua_reales + ml_reales ÷ 1000)`. Hay sobredosis si supera la receta más la tolerancia (propuesta: 10%). También se marca si supera el máximo de la ficha. |
| RN-06 | Comparación de variantes: es elegible la que tiene al menos el mínimo de repeticiones (propuesta: 3) y cumple el criterio en todas. Se recomienda la de menor producto promedio y se desempata por agua promedio. |
| RN-07 | Incompatibilidad: hay conflicto si alguna categoría del producto A figura en las incompatibilidades del producto B, o al revés. |
| RN-08 | Efluente, en este orden: no disponible si el pH es nulo o la concentración preparada está lejos de la del pH de la ficha; gestor si quedan sobrantes concentrados; ajustar si el pH estimado está fuera del rango de descarga; reutilizar si se permite el reúso; en otro caso, verter. El rango de descarga es configurable (valor de ejemplo hasta verificarlo en el TULSMA, Acuerdo 097-A, Libro VI). |
| RN-09 | El resultado cumple el criterio solo si todos los criterios evaluados cumplen. El valor se calcula en código, no se digita. |
| RN-10 | Todo dato simulado se guarda con fuente «simulada» y se rotula en la interfaz. |

# 6. Modelo de datos

Base de datos PostgreSQL en Supabase. Todas las tablas tienen `id` (uuid) y `created_at`. Los esquemas Zod de `packages/schemas` reflejan este modelo y son la fuente de los tipos. Relaciones: sitio 1-N área 1-N tarea; producto 1-N tarea; tarea 1-N variante; tarea 1-N registro de uso; registro 1-1 resultado 1-1 decisión de efluente.

| Tabla | Campos principales | Restricciones |
|---|---|---|
| `sitios` | `nombre`, `tipo`, `criterios_limpieza` (lista de textos en JSON) | — |
| `areas` | `sitio_id`, `nombre`, `superficie_m2`, `tipo_superficie`, `litros_solucion_por_m2` | `sitio_id` obligatorio; superficie mayor que 0; litros por m² opcional y mayor que 0 |
| `productos` | `nombre`, `tipo_quimico`, `categorias`, `incompatibilidades`, `dilucion_min` / `dilucion` / `dilucion_max` (ml por litro), `dilucion_texto_ficha`, `ph`, `concentracion_ph`, `ph_medido_a_ml_por_litro`, `indicaciones_disposicion`, `url_ficha_tecnica`, `url_hoja_seguridad` | mínimo menor o igual que recomendada menor o igual que máximo; pH entre 0 y 14 |
| `tareas` | `area_id`, `producto_id`, `nivel_suciedad`, `litros_solucion_esperados`, `ml_producto_esperados` | área y producto obligatorios; suciedad: baja, media o alta; esperados mayores que 0 |
| `variantes` | `tarea_id`, `nombre`, `dilucion_ml_por_litro`, `repeticiones` (planificadas) | dilución mayor que 0; repeticiones enteras positivas |
| `registros_uso` | `tarea_id`, `variante_id` (opcional), `litros_agua_reales`, `ml_producto_reales`, `duracion_min`, `marca`, `fuente`, `alerta_sobredosis` | agua mayor que 0; producto mayor o igual que 0; marca: medido o estimado; fuente: manual, simulada o sensor |
| `resultados` | `registro_uso_id`, `cumple_criterio`, `criterios_evaluados` (JSON), `observaciones` | un resultado por registro (único) |
| `decisiones_efluente` | `resultado_id`, `orientacion`, `decision_final`, `ph_estimado`, `observaciones` | orientación: verter, ajustar, reutilizar, gestor o no disponible; decisión final sin «no disponible»; una por resultado |

Los cambios al modelo se hacen con migraciones nuevas en `supabase/migrations`, nunca editando a mano en el panel, para que el repositorio y la base sigan iguales.

# 7. Arquitectura y construcción

## 7.1 Visión general

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Frontend | React, Vite y TypeScript, como PWA | Pantallas del operario y del supervisor, navegación móvil, reporte imprimible. |
| Lógica de dominio | `packages/core` (TypeScript puro) | Receta, desvío, comparación, incompatibilidades y efluente, sin dependencia de interfaz ni de la base. |
| Contratos | `packages/schemas` (Zod) | Validación y tipos compartidos por frontend y backend. |
| Datos y backend | Supabase (PostgreSQL) | Tablas, restricciones, migraciones y políticas RLS de demostración. |
| Función de IA (P1) | Función serverless en el servidor | Recibe JSON ya calculado y devuelve texto explicativo; guarda la clave del LLM. |
| Despliegue y calidad | Vercel, GitHub y GitHub Actions | Enlace público, vista previa por pull request y CI con lint, build y pruebas. |

## 7.2 Estructura del repositorio

```text
ecocleaner/
  apps/web/src/
    app/                         router, layouts, MobileLayout
    features/
      operario/pages/            receta, registro, criterio, efluente
      supervisor/pages/          sitio nuevo, panel, comparacion, reporte
    components/ui/               Button, Card, Field, Select, Alert, PageHeader
    services/                    un archivo por entidad (productos, sitios...)
    lib/                         utilidades y cliente de Supabase
  packages/core/                 logica de dominio y pruebas
  packages/schemas/              esquemas Zod y tipos
  supabase/migrations/           SQL versionado
  docs/                          alcance, catalogo, decisiones, arquitectura
```

## 7.3 Frontend

- Los componentes no llaman a Supabase directamente: usan `services/`. La lógica de negocio se importa de `@ecocleaner/core`.
- Cada persona edita solo su carpeta de feature. Los cambios en `App.tsx`, `MobileLayout` o `components/ui` se coordinan por el grupo o con un pull request pequeño aparte.
- Las cantidades se capturan con selectores de litros y mililitros, sin texto libre.
- Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` van en `apps/web/.env`, que no se versiona.

### Rutas y pantallas

| Ruta | Pantalla | Perfil | Prior. |
|---|---|---|---|
| `/` | Inicio y selección de rol | Ambos | P0 |
| `/operario` | Inicio del operario | Operario | P0 |
| `/operario/receta` | Receta de la tarea | Operario | P0 |
| `/operario/registro` | Registro de uso y alertas | Operario | P0 |
| `/operario/criterio` | Criterio de limpieza | Operario | P0 |
| `/operario/efluente` | Guía de efluente y decisión | Operario | P0 |
| `/supervisor` | Inicio del supervisor | Supervisor | P0 |
| `/supervisor/sitios/nuevo` | Crear sitio desde plantilla | Supervisor | P0 |
| `/supervisor/panel` | Panel de consumo | Supervisor | P0 |
| `/supervisor/comparacion` | Comparación de variantes | Supervisor | P0 |
| `/supervisor/reporte` | Reporte imprimible | Supervisor | P0 |

## 7.4 Backend

- Supabase aloja las tablas y las restricciones del modelo. Las migraciones se versionan en el repositorio.
- RLS está activo con políticas de demostración abiertas. Para producción harán falta autenticación y políticas por usuario (hoja de ruta).
- Función de IA (P1): recibe únicamente JSON con resultados ya calculados, no calcula ni inventa cifras, responde «no tengo esa información, revise la ficha de seguridad» cuando el dato no está, y tiene un tiempo máximo de espera con texto plantilla de respaldo.
- Se evalúa el explicador con 10 a 15 preguntas de prueba, incluidos casos en los que debe negarse a responder.

## 7.5 Núcleo de dominio (`packages/core`)

Funciones puras y probadas. Usan los tipos de `@ecocleaner/schemas` y no acceden a la base.

| Función | Entradas | Salidas |
|---|---|---|
| `calcularReceta` | `superficie_m2`, `litros_solucion_por_m2`, `nivel_suciedad`, producto (rango de dilución) | `litros_solucion`, `ml_por_litro`, `ml_producto`, `litros_agua` |
| `calcularDesvio` | receta, `litros_agua_reales`, `ml_producto_reales`, dilución máxima, tolerancia | `ml_por_litro_real`, `desvio_pct`, `sobredosis`, `supera_maximo_ficha` |
| `compararVariantes` | variantes con sus registros (agua, producto, cumple), mínimo de repeticiones | resumen por variante, variante recomendada o nula, motivo |
| `detectarIncompatibilidades` | productos con categorías e incompatibilidades | pares en conflicto con su categoría |
| `evaluarEfluente` | pH y concentración del producto, ml por litro preparado, rango de descarga, sobrantes, reúso | orientación, pH estimado, motivo |

## 7.6 Calidad y flujo de trabajo

- Ramas cortas y un pull request por tarjeta del tablero, con una aprobación y el check de CI en verde antes del merge.
- El CI ejecuta lint, build y pruebas en cada pull request. Las pruebas pendientes se declaran con `it.todo` para no bloquearlo.
- Pruebas unitarias de core: 16 casos definidos en `packages/core/src/pendientes.test.ts`.
- Dependencias declaradas en el `package.json` del workspace que las usa, para que Vercel pueda instalarlas.

# 8. Catálogo de productos y datos de demostración

- Seis productos con ficha técnica (dilución) y hoja de seguridad (pH, incompatibilidades, disposición), con enlace a ambos documentos.
- Variedad de categorías para demostrar las incompatibilidades. Vocabulario propuesto: `hipoclorito`, `acido`, `alcalino`, `amoniaco`, `amonio_cuaternario`, `peroxido`, `solvente` y `otro`. Debe validarse con la sección 10 de cada hoja de seguridad.
- El pH de la ficha se usa solo si fue medido a una concentración cercana a la preparada; si no, el sistema responde «dato no disponible».
- Plantilla de carga en `docs/catalogo-plantilla.json` (contiene un ejemplo ficticio que debe reemplazarse con datos reales).
- Los datos de demostración combinan los resultados reales de la mini-prueba con datos simulados rotulados como tales.

# 9. Pruebas y criterios de aceptación

## 9.1 Mini-prueba controlada

Protocolo escrito antes de medir: producto, superficie, 3 variantes con 3 repeticiones, qué se mide (agua, producto y tiempo) y criterio de limpieza. Los resultados se presentan como muestra pequeña, sin extrapolar.

## 9.2 Flujo de demostración

| Paso | Qué se muestra |
|---:|---|
| 1 | Se elige el área y el producto, y la app muestra la receta calculada. |
| 2 | Se registra el uso real, marcado como medido o estimado, y salta una alerta de sobredosis. |
| 3 | Se evalúa el criterio de limpieza. |
| 4 | La comparación descarta la variante barata que no limpió y recomienda la siguiente que sí cumple. |
| 5 | La guía de efluente orienta qué hacer y se registra la decisión. |
| 6 | El panel muestra consumo y desvíos, y se imprime el reporte. |
| 7 | (P1) El simulador de fuga dispara la alerta en vivo y el explicador redacta la recomendación. |

## 9.3 Criterios de cierre del prototipo

- El flujo P0 completo funciona de punta a punta con datos guardados en Supabase.
- Probado en al menos 2 celulares reales y desplegado en un enlace público.
- CI en verde y pruebas de core implementadas.
- Existe un video de respaldo de la demostración y datos precargados por si falla la red.

# 10. Plan, roles, riesgos y decisiones abiertas

## 10.1 Cronograma

| Fechas | Objetivo |
|---|---|
| Sábado 10 a jueves 15 de octubre | Desarrollo previo. Flujo completo desplegado el lunes 12 y P0 congelado el jueves 15. |
| Viernes 16 de octubre (8 horas) | Día de desarrollo: P1, corrección de errores, integración y datos finales. Congelamiento al final. |
| Sábado 17 de octubre (4 horas) | Pruebas, corrección de errores críticos, entregables y ensayos del pitch. |

## 10.2 Roles

| Rol | Responsabilidades principales |
|---|---|
| Líder técnico e integración | Repositorio, CI y despliegue, esquema y migraciones, revisión de pull requests y control de alcance. |
| Backend y dominio | `packages/core` con pruebas, consultas y agregados para panel y reporte, función del LLM (P1). |
| Frontend operario | Receta, registro de uso, criterio de limpieza, guía de efluente, PWA y QR (P1). |
| Frontend supervisor | Sitio desde plantilla, panel, comparación, reporte imprimible y simulador de fuga (P1). |
| QA, datos y documentación | Catálogo de 6 productos, mini-prueba, plan de pruebas en celulares, README, diagrama y bitácora de decisiones. |

## 10.3 Decisiones abiertas (parámetros propuestos)

| Decisión | Propuesta actual |
|---|---|
| Tolerancia de sobredosis | 10% sobre la receta, configurable. |
| Mínimo de repeticiones para recomendar | 3, igual que la mini-prueba. |
| Orden entre variantes | Menor producto promedio y desempate por agua; evaluar ponderar ambos. |
| Rango de pH de descarga | Configurable, con valor de ejemplo; verificar en el TULSMA (Acuerdo 097-A, Libro VI). |
| Cercanía de concentración para usar el pH de la ficha | Entre 0,5 y 2 veces la concentración a la que se midió. |
| Litros de solución por m² | Calibrar con la mini-prueba; supuesto editable mientras tanto. |
| Vocabulario de categorías químicas | Lista propuesta; validar con la sección 10 de cada hoja de seguridad. |

## 10.4 Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Registro autodeclarado por el operario | Selectores en lugar de texto libre, marca medido o estimado y dosificadores con medición automática en la hoja de ruta. |
| Datos simulados en la demostración | Rotulados como simulados; no se presentan como evidencia de ahorro. |
| Recomendar una dilución insegura | Rango de la ficha obligatorio en el código y restricciones en la base. |
| Fichas incompletas | Solo productos con ficha técnica y hoja de seguridad; respuesta «dato no disponible» cuando falta un dato. |
| Muestra pequeña en la mini-prueba | Declarar el tamaño y no extrapolar los resultados. |
| LLM lento o impreciso | Fuera del camino crítico, texto plantilla de respaldo y solo narra datos ya calculados. |
| RLS de demostración abierta | Limitación declarada; autenticación y políticas por usuario en la hoja de ruta. |
| Cambios tardíos que rompen la demo | Congelar funciones el jueves 15 y mantener un video de respaldo. |

## Referencias internas

- `docs/alcance.md`
- `supabase/migrations`
- `packages/schemas`
- `packages/core`
- Tablero de Trello del equipo
- Criterios de evaluación del hackatón

---

**Versión 1.0 · 10 de octubre de 2026 · Borrador para desarrollo**
