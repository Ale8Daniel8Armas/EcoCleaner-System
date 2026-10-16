# Asistente determinista del supervisor

Las opciones **Explicar resultados (demo)** y **Conversatorio (demo)** interpretan datos cargados por EcoCleaner mediante las mismas plantillas locales. No es IA generativa: no necesita claves, no llama a proveedores y no utiliza la Edge Function del PR #11. Cada respuesta es preliminar y requiere revisión humana.

## Navegación del Dashboard (Fase 9)

**Asistente LLM (demo)** abre `/supervisor/asistente` desde el menú lateral de escritorio, debajo de **Panel**; en móvil aparece como **LLM demo**. La vista abre las preguntas preconfiguradas y reutiliza el conversatorio existente. **Volver al panel** regresa a `/supervisor`. En modo `off` no hay enlaces al asistente y el acceso directo vuelve al panel; se conserva el control de rol existente.

El Dashboard conserva métricas, filtros y resultados sin montar el explicador ni su formulario de pregunta. Los formularios de gestión ya estaban separados en la base de esta fase: se reutilizan `/supervisor/productos/nuevo`, `/supervisor/sitios/nuevo` y `/supervisor/usuarios`, con sus validaciones, servicios, edición y cancelación existentes. La lista de sitios sigue en `/supervisor/sitios`. No se duplicaron ni migraron de nuevo esos formularios.

Se retira exclusivamente la opción visual **Ver referencias de los registros** (nombre encontrado en el código) de las respuestas del asistente. Se conservan las referencias internas, los registros y el componente compartido, que solo se renderiza con la opción explícita `showReferences`. No se añaden operaciones de eliminación ni se modifican servicios de persistencia.

## Arquitectura y origen

- `services/supervisor.ts` incorpora `obtenerDatosExplicadorSupervisor`, usando el cliente Supabase existente. Se carga al montar el explicador para supervisor en modo demo, independientemente de las consultas del resto del panel. Abrir cualquiera de las dos opciones o enviar preguntas no inicia consultas adicionales; ambas comparten la misma carga.
- Una consulta de solo lectura proyecta tareas, ficha de producto, variantes, registros, resultados y decisiones relacionadas. Incluye únicamente los nombres operativos de áreas y variantes; no consulta perfiles de usuarios, correos, observaciones ni credenciales.
- Una respuesta vacía correcta de Supabase permanece vacía: no se sustituye por registros locales. Ante error se utiliza el estado local existente del navegador, con origen explícito y catálogo de referencia identificado como simulado.
- Se cargan hasta 200 tareas, con un centinela adicional para detectar truncamiento; se aplica el mismo límite a variantes y registros de cada tarea. Las cargas parciales se advierten. No se añaden tablas, servicios duplicados ni clientes Supabase.
- El resumen abarca todas las áreas y tareas cargadas, sin filtro de fechas; el selector de área del panel no filtra el explicador. El aviso visible lo aclara. No hay un periodo temporal inferido.

## `buildExplainerInput(snapshot)`

Función pura y tipada en `apps/web/src/features/supervisor/explainer`. Recibe la proyección de las tareas y sus relaciones; no consulta HTTP ni modifica las entradas.

Solo el estado `completada` contribuye a consumos, limpieza, procedencia, alertas, variantes y decisiones. `receta_enviada` se cuenta como pendiente. Los estados desconocidos quedan separados y no contribuyen a métricas finales.

Los consumos declarados finales requieren un único registro válido por tarea. Varias repeticiones no se suman como si fueran un consumo final inequívoco. La receta se cuenta una vez por tarea. Se exponen coberturas de declarado, esperado y una base común de tareas con ambos valores. Los agregados se presentan con hasta seis decimales; los resultados del core permanecen intactos. Los totales no representables generan un error controlado.

Reutiliza `calcularDesvio` con receta, agua, producto y máximo de ficha disponibles. Una alerta registrada se conserva aunque falten datos para recalcularla. No se infieren dosificaciones ni máximos. La proyección de Supabase reconstruye las unidades de la receta almacenada desde solución y producto esperados, sin una dosis por defecto.

Reutiliza `compararVariantes` únicamente para variantes vinculadas a la misma tarea y documentadas dentro del rango de ficha. Conserva el mínimo, la elegibilidad, los empates y los motivos del core. No agrupa variantes de tareas distintas. Una recomendación es observacional y no prescribe cambiar dosis.

La comparación entre áreas considera el mayor desvío absoluto de concentración en mediciones no simuladas del mismo producto, suciedad y dosis de receta. Conserva el signo y los empates. No compara consumos absolutos, rendimientos ni grupos de condiciones diferentes.

Medidos no simulados, estimados no simulados, simulados y procedencia desconocida son categorías excluyentes. Sus proporciones se calculan en el input, sobre los registros de tareas completadas. Un registro simulado no se presenta como una medición verificada. Una evaluación ausente o ambigua no equivale a cumplimiento; varias repeticiones incumplidas cuentan como una tarea incumplida.

Las identidades internas se conservan para los cálculos y la trazabilidad. Las respuestas usan nombres operativos de tarea, área y variante, con etiquetas cortas para distinguir registros homónimos. Los UUID completos permanecen en la proyección interna; no aparecen en las cuatro secciones ni en un desplegable del asistente.

El modelo de Supabase actual no tiene una columna separada para el nombre de la tarea: el flujo guarda la actividad en su variante. Si existe una única variante con nombre válido, se reutiliza esa etiqueta como actividad, igual que en el flujo actual. Cuando hay varias, no se elige una arbitrariamente: se muestra «Tarea N · Área». El fallback local utiliza `tipo_tarea` y el catálogo local de áreas, incluidas las áreas personalizadas ya guardadas. Los nombres ausentes o no válidos quedan identificados como tales; no se inventan actividades.

La proyección admite solo esos campos operativos, valida longitud y formato y rechaza etiquetas con correos, HTML, URLs o patrones evidentes de credenciales. No incorpora nombres de usuarios ni observaciones. Dos tareas, áreas o variantes que comparten nombre conservan identidades y resultados distintos. Las limitaciones del transporte siguen siendo códigos cerrados traducidos a textos constantes.

## `explainDemo(preguntaId, input)`

Función pura que lee valores ya preparados. Cada respuesta contiene exactamente **Resumen**, **Evidencia**, **Recomendación preliminar** y **Limitaciones**, como texto plano. Las cifras proceden del input; no se recalculan métricas en las plantillas.

Cuando falta evidencia utiliza **No hay datos suficientes para responder** y explica qué falta, conservando las cuatro secciones. Las prioridades siguen un orden determinista: alertas documentadas, incumplimientos de limpieza, decisiones de efluente no disponibles y registros incompletos.

## Nueve preguntas

1. Resumen del periodo
2. ¿Qué área presenta mayor desvío frente a la receta?
3. ¿Hubo sobredosis o valores sobre el máximo de la ficha? ¿En qué tareas?
4. ¿Qué variante se recomienda y por qué?
5. ¿Qué variantes se descartan y por qué?
6. ¿Cuántas tareas no cumplieron el criterio de limpieza?
7. ¿Qué decisiones de efluente se registraron?
8. ¿Qué limitaciones tienen estos datos?
9. ¿Qué debería revisar primero?

## Conversatorio demo

La vista del asistente ofrece **Conversatorio (demo)** junto al explicador. Abre el mismo panel, conservando las nueve preguntas preconfiguradas en su opción original. El campo **Tu pregunta** admite hasta 500 caracteres; se envía con **Enviar** o Enter. Se indica el procesamiento local, datos insuficientes y errores controlados.

`resolveDemoQuestion(text)` normaliza signos, acentos, espacios y mayúsculas, y utiliza reglas sencillas para reconocer una sola de las nueve categorías del catálogo existente. Por ejemplo: «¿Cómo vamos con las tareas?», «¿Hubo sobredosis?» o «¿Qué debería revisar primero?». Las preguntas desconocidas, ambiguas, vacías, excesivamente largas o con HTML/instrucciones no admitidas no seleccionan una categoría arbitraria. Se conserva el respaldo con cuatro secciones y el mensaje:

> Esta pregunta no está disponible en el modo demostración. Puedes consultar tareas, consumos, desvíos, variantes, limpieza o efluentes.

`createDemoConversationReply` recibe únicamente el identificador reconocido y el input ya preparado. Delega las respuestas a `explainDemo`, sin repetir cálculos ni crear otro catálogo. No interpreta filtros por nombres, fechas o variantes: muestra la categoría completa sobre las tareas cargadas. Una pregunta sobre una variante concreta no acredita que se haya identificado o filtrado esa variante.

Cada consulta es independiente. No existe memoria conversacional ni historial persistente. El texto se borra al enviar; no se copia a la respuesta, no se registra en logs y no se almacena en Supabase ni localStorage. Cerrar o cambiar de opción descarta el estado temporal y cancela cualquier respuesta pendiente. No se ejecutan instrucciones ni se interpreta HTML.

Las respuestas siguen disponibles con los datos en memoria después de cargar y activar la emulación offline. La visibilidad reutiliza el rol supervisor y `VITE_LLM_MODE`: ausente/demo habilita ambas opciones; off o valores desconocidos las ocultan. No se crea un modo real ni se habilita Groq.

## Interfaz, contenido y configuración

`LlmAssistant` reutiliza `DemoExplainer` en una ruta del supervisor, con la explicación abierta inicialmente. Los accesos del menú lateral y de la barra móvil usan `canShowDemo`; la vista también comprueba el modo. El botón y el panel se ocultan para operarios y revisores. Se reutiliza la sesión existente, sin modificar login ni roles. **Es una restricción de interfaz y no autorización segura de servidor.**

`VITE_LLM_MODE` acepta `demo` y `off`. Ausente equivale a `demo`; `off`, vacío o cualquier otro valor desactivan el explicador. Se configura al iniciar Vite o al construir la aplicación. No existe modo `real`. El ejemplo está en `apps/web/.env.example`.

El aviso permanece en el panel:

> Modo demostración: respuestas preconfiguradas a partir de los datos calculados. Explicación preliminar, requiere revisión humana.

Se contemplan carga, ausencia de tareas, información insuficiente, respuesta disponible, origen simulado y error. Las excepciones de preparación y renderizado quedan aisladas del panel supervisor. Los botones funcionan con teclado y el cierre devuelve el foco al botón de apertura. Las secciones se adaptan a móvil y escritorio.

React escapa el texto; no se interpreta HTML ni se usa `dangerouslySetInnerHTML`. El campo escrito solo clasifica categorías; no genera contenido libre. No hay observaciones ni importaciones del adaptador Groq o de módulos exclusivos de servidor. Las plantillas no recomiendan mezclas, reducción de dosis, diluciones alternativas ni disposición automática. Se verifica la terminología prohibida mediante pruebas. Se conserva una recomendación conservadora también para cloro, desinfectantes y productos desconocidos. Las decisiones de efluente se describen como históricas y nunca autorizan una descarga.

## Pruebas y evidencias

Fase 9: **449 pruebas locales aprobadas, cero fallidas** (232 web y 217 core/LLM P1). Las 17 nuevas comprueban navegación, visibilidad por rol/modo y retiro visual de referencias con datos poblados e inmutables. TypeScript, builds web/schemas, lint sin errores y formato de los archivos nuevos y del módulo modificado aprobados. Persisten los seis avisos de lint y el aviso de tamaño del bundle. Cuatro archivos compartidos ya diferían de Prettier en el commit base; se conserva su estilo para evitar un reformateo ajeno.

Se ejecutaron **46 comprobaciones de navegador** en un origen local aislado, con Supabase desconfigurado solo en el proceso de pruebas: Dashboard y filtro, rutas de formularios, validaciones, guardado de un producto ficticio y un sitio, edición/cancelación del nombre de un usuario ficticio sin cambiar contraseña ni rol, nueve preguntas, conversatorio, modo `off`, controles de rol y escritorio 1440×1000/móvil 390×844. Sin errores de consola durante los recorridos normales. Las tareas del explicador estaban vacías en navegador; los casos poblados y errores controlados se cubren con fixtures unitarios. El fallback de productos existente conserva altas solo en memoria durante la sesión. No se modificaron servicios ni registros reales; no se ejecutaron eliminaciones. NOT RUN: Supabase real, errores de escritura contra una base real, captura de tráfico de red y dispositivo físico. Las capturas, resultados y comparación de formato del commit base se guardan fuera del repositorio; no son las evidencias históricas de otras computadoras.

Desde la raíz del repositorio:

```powershell
npm run test --workspace web
npm test --workspaces --if-present
npm run lint --workspaces --if-present
npm run build --workspaces --if-present
npm run format:check -- apps/web/src/features/supervisor/explainer docs/llm-demo.md apps/web/package.json
git diff --check
```

Las pruebas del explicador cubren pureza, contratos, regresiones de proyección, reutilización del core, estados, procedencia, cifras, seguridad, roles, configuración, renderizado escapado y errores. El workspace web declara la misma versión de Vitest que ya utiliza el core; no se añade otro framework. Los dos archivos compartidos conservan el estilo legado; la comprobación de formato se aplica al código nuevo.

Validación de la Fase 7: **311 pruebas aprobadas, 0 fallidas, 0 TODO** (217 existentes del core/LLM P1 y 94 nuevas del explicador). TypeScript y builds de web/schemas aprobados; lint sin errores nuevos, con seis avisos preexistentes fuera del módulo. Vite advierte del tamaño del bundle principal; no se cambia su configuración. Formato del código nuevo y `git diff --check` aprobados. El formato completo de los dos archivos compartidos ya incumplía Prettier en el commit base; se verifica en `format-baseline.json` sin reformatear el legado.

Evidencias externas al repositorio: `D:\ECOCLEANER\evidencias\llm-demo\2026-10-15`.

- `browser-evidence.cjs`: procedimiento reproducible con Playwright y Edge instalado; solo datos de prueba locales rotulados como simulados. Las sesiones de prueba están aisladas. No crea tareas ni modifica datos en Supabase.
- `network.json`, `network-report.html` y `network.png`: registro automatizado de solicitudes después de la carga inicial. Se ejecutan las nueve preguntas. La captura es un informe del registro de Playwright, no una captura de DevTools. No equivale a afirmar ausencia de tráfico inicial de la PWA.
- `answers.json` y `browser-results.json`: respuestas y comprobaciones verificables. La prueba offline usa emulación del navegador, comprueba las nueve respuestas y restaura la conexión original del contexto; no prueba modo avión físico.
- `desktop.png`, `mobile.png`, `mobile-answer.png`, `offline.png`, `empty.png` y `controlled-error.png`: capturas de ejecución.
- `desktop.mp4` y `mobile.mp4`: grabaciones de aproximadamente 20 segundos de acciones reales automatizadas, obtenidas mediante screencast del navegador y codificadas con FFmpeg.

Los archivos pesados no se versionan. Los fixtures nunca se cargan desde la interfaz productiva. La consulta a una instancia real de Supabase y la validación en dispositivos físicos no quedan acreditadas por estas pruebas locales; el servicio y los formatos de PostgREST se verifican con simulaciones y pruebas de proyección.

Validación de la Fase 8: **394 pruebas aprobadas, 0 fallidas, 0 TODO** (311 anteriores y 83 nuevas del conversatorio). TypeScript/build web y schemas, lint, formato de los archivos cambiados y `git diff --check` aprobados. Permanecen los seis avisos de lint preexistentes y el aviso de tamaño de bundle. Estos resultados corresponden a la validación local. La publicación requiere autorización; el estado de CI del commit publicado se consulta en las verificaciones del PR #12. La aprobación e integración corresponden al líder.

Evidencias del conversatorio en `D:\ECOCLEANER\evidencias\llm-demo\2026-10-15\fase-8`: `browser-check.cjs`, `browser-results.json`, `network.json` y capturas `desktop.png`, `mobile.png`, `mobile-answer.png`, `offline.png`, `unknown.png`, `empty.png` y `controlled-error.png`. Se verificaron las nueve respuestas escritas contra sus equivalentes preconfiguradas, Enter/Enviar, rechazo de desconocidas/ambigüedad/HTML/instrucciones, borrado del campo, ausencia de texto privado en respuestas/logs observados, almacenamiento sin cambios, estados de procesamiento y error, cierre/foco, rol y modo off. El registro automatizado después de cargar detectó cero solicitudes HTTP adicionales, cero llamadas LLM y cero llamadas Edge. No es una captura de DevTools. La prueba offline fue emulada, con las nueve respuestas idénticas y conexión restaurada. Los datos son fixtures locales rotulados como simulados; no se realizó validación contra Supabase real ni en un dispositivo físico. No se generaron videos nuevos.

Validación del ajuste de referencias legibles: **423 pruebas aprobadas, 0 fallidas, 0 TODO** (217 del core/LLM P1 y 206 del explicador/conversatorio, incluidas 29 nuevas). Se comprueban nombres presentes, ausentes y repetidos, proyección de campos operativos, conservación de identidades y métricas, y ausencia de UUID en las cuatro secciones de las nueve respuestas. Build y lint aprobados, con los avisos preexistentes ya descritos.

Evidencias de este ajuste en `D:\ECOCLEANER\evidencias\llm-demo\2026-10-15\referencias-legibles`: `browser-check.cjs`, `browser-results.json` y cinco capturas de escritorio, conversatorio, móvil y referencias desplegadas. Playwright con Chrome instalado verifica los nombres legibles, apertura/cierre de los códigos completos, equivalencia con el conversatorio, ausencia de desbordamiento horizontal en móvil y almacenamiento sin cambios. La emulación offline después de cargar mantiene la respuesta; el registro automatizado observa cero solicitudes HTTP posteriores a la carga inicial. Son datos sintéticos locales marcados como simulados, en sesiones aisladas; no acredita una consulta real a Supabase ni modo avión físico.

La subcarpeta `nueve-preguntas` contiene nueve capturas del explicador y nueve del conversatorio, una galería HTML y los resultados de su comparación. Se verifican las cuatro secciones sin UUID y respuestas idénticas en los nueve temas, también con emulación offline después de cargar. Incluye un caso adicional de sobredosis sin alertas. Los escenarios sintéticos combinan marcas manuales y simuladas para cubrir distintos resultados; no representan mediciones físicas ni se escriben en Supabase.

## Extensión y límites

Para admitir una nueva formulación de una intención existente: ajustar exclusivamente su regla en `conversation.ts`, añadir ejemplos reconocidos y casos ambiguos a `conversation.test.tsx`, y comprobar que solo haya una coincidencia. Para una categoría nueva se requiere ampliar el catálogo tipado y la plantilla con sus cuatro secciones y pruebas de evidencia, números, privacidad y seguridad. Esta fase mantiene las nueve categorías. No introducir cálculos de dominio ni generación libre en las respuestas.

Los datos incompletos, las relaciones ambiguas, los consumos finales no unívocos, la procedencia y las condiciones insuficientes limitan las conclusiones. Los alias locales son relativos a la carga actual. Las decisiones registradas no sustituyen inspección ni medición ambiental. El análisis no constituye una validación independiente de los registros.

La integración futura de un proveedor real requerirá Supabase Auth, autorización exclusiva del jefe supervisor, RLS por rol y recurso, clave solo en servidor, consentimiento para transferencia de datos, cuotas distribuidas, evaluación real del proveedor y habilitación controlada de la Edge Function. Nada de ello se implementa o activa en esta fase. El core, los esquemas, el login, los roles, las migraciones, RLS y la Edge Function permanecen intactos.
