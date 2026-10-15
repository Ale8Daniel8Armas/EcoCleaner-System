# Explicador determinista del panel supervisor

El botón **Explicar resultados (demo)** interpreta datos cargados por EcoCleaner mediante plantillas locales. No es IA generativa: no necesita claves, no llama a proveedores y no utiliza la Edge Function del PR #11. Cada respuesta es preliminar y requiere revisión humana.

## Arquitectura y origen

- `services/supervisor.ts` incorpora `obtenerDatosExplicadorSupervisor`, usando el cliente Supabase existente. Se carga al montar el explicador para supervisor en modo demo, independientemente de las consultas del resto del panel. Abrirlo o elegir preguntas no inicia consultas.
- Una consulta de solo lectura proyecta tareas, ficha de producto, variantes, registros, resultados y decisiones relacionadas. No solicita nombres, usuarios, correos, observaciones ni credenciales.
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

Las referencias UUID de tarea, área y registro permiten trazabilidad sin nombres. Identificadores no normalizados reciben alias según posición en la carga. Las limitaciones del transporte son códigos cerrados traducidos a textos constantes; no se propaga texto libre.

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

## Interfaz, contenido y configuración

`DemoExplainer` se incorpora al inicio del panel supervisor mediante un cambio mínimo. El botón y el panel se ocultan para operarios y revisores. Se reutiliza la sesión existente, sin modificar login ni roles. **Es una restricción de interfaz y no autorización segura de servidor.**

`VITE_LLM_MODE` acepta `demo` y `off`. Ausente equivale a `demo`; `off`, vacío o cualquier otro valor desactivan el explicador. Se configura al iniciar Vite o al construir la aplicación. No existe modo `real`. El ejemplo está en `apps/web/.env.example`.

El aviso permanece en el panel:

> Modo demostración: respuestas preconfiguradas a partir de los datos calculados. Explicación preliminar, requiere revisión humana.

Se contemplan carga, ausencia de tareas, información insuficiente, respuesta disponible, origen simulado y error. Las excepciones de preparación y renderizado quedan aisladas del panel supervisor. Los botones funcionan con teclado y el cierre devuelve el foco al botón de apertura. Las secciones se adaptan a móvil y escritorio.

React escapa el texto; no se interpreta HTML ni se usa `dangerouslySetInnerHTML`. No hay chat libre, observaciones ni importaciones del adaptador Groq o de módulos exclusivos de servidor. Las plantillas no recomiendan mezclas, reducción de dosis, diluciones alternativas ni disposición automática. Se verifica la terminología prohibida mediante pruebas. Se conserva una recomendación conservadora también para cloro, desinfectantes y productos desconocidos. Las decisiones de efluente se describen como históricas y nunca autorizan una descarga.

## Pruebas y evidencias

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

Validación local de esta entrega: **311 pruebas aprobadas, 0 fallidas, 0 TODO** (217 existentes del core/LLM P1 y 94 nuevas del explicador). TypeScript y builds de web/schemas aprobados; lint sin errores nuevos, con seis avisos preexistentes fuera del módulo. Vite advierte del tamaño del bundle principal; no se cambia su configuración. Formato del código nuevo y `git diff --check` aprobados. El formato completo de los dos archivos compartidos ya incumplía Prettier en el commit base; se verifica en `format-baseline.json` sin reformatear el legado.

Evidencias externas al repositorio: `D:\ECOCLEANER\evidencias\llm-demo\2026-10-15`.

- `browser-evidence.cjs`: procedimiento reproducible con Playwright y Edge instalado; solo datos de prueba locales rotulados como simulados. Las sesiones de prueba están aisladas. No crea tareas ni modifica datos en Supabase.
- `network.json`, `network-report.html` y `network.png`: registro automatizado de solicitudes después de la carga inicial. Se ejecutan las nueve preguntas. La captura es un informe del registro de Playwright, no una captura de DevTools. No equivale a afirmar ausencia de tráfico inicial de la PWA.
- `answers.json` y `browser-results.json`: respuestas y comprobaciones verificables. La prueba offline usa emulación del navegador, comprueba las nueve respuestas y restaura la conexión original del contexto; no prueba modo avión físico.
- `desktop.png`, `mobile.png`, `mobile-answer.png`, `offline.png`, `empty.png` y `controlled-error.png`: capturas de ejecución.
- `desktop.mp4` y `mobile.mp4`: grabaciones de aproximadamente 20 segundos de acciones reales automatizadas, obtenidas mediante screencast del navegador y codificadas con FFmpeg.

Los archivos pesados no se versionan. Los fixtures nunca se cargan desde la interfaz productiva. La consulta a una instancia real de Supabase y la validación en dispositivos físicos no quedan acreditadas por estas pruebas locales; el servicio y los formatos de PostgREST se verifican con simulaciones y pruebas de proyección.

## Extensión y límites

Para añadir preguntas posteriormente: ampliar el catálogo tipado, implementar la plantilla con estas cuatro secciones y añadir pruebas de evidencia, números, privacidad y seguridad. Mantener exactamente las nueve preguntas durante esta fase. No introducir cálculos de dominio en las respuestas ni entradas de conversación libre.

Los datos incompletos, las relaciones ambiguas, los consumos finales no unívocos, la procedencia y las condiciones insuficientes limitan las conclusiones. Los alias locales son relativos a la carga actual. Las decisiones registradas no sustituyen inspección ni medición ambiental. El análisis no constituye una validación independiente de los registros.

La integración futura de un proveedor real requerirá Supabase Auth, autorización exclusiva del jefe supervisor, RLS por rol y recurso, clave solo en servidor, consentimiento para transferencia de datos, cuotas distribuidas, evaluación real del proveedor y habilitación controlada de la Edge Function. Nada de ello se implementa o activa en esta fase. El core, los esquemas, el login, los roles, las migraciones, RLS y la Edge Function permanecen intactos.
