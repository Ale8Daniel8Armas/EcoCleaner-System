# Validación local de Groq

El ejecutor de `scripts/groq-live-local` reutiliza `createLLMExplainer`, el adaptador Groq, sus contratos y validadores. Ofrece una interfaz aislada y un modo de desarrollo integrado en la aplicación. No utiliza plantillas como respuesta generada. El modo demo y la Edge Function se conservan.

## Aplicación local con contexto general

El conversatorio usa ahora texto libre mediante `chat.ts`, con el mismo modelo y adaptador Groq. No impone el JSON de seis campos del informe ni el filtro que rechazaba «mezclar» incluso en advertencias. Permite conocimiento general y seguimientos; para los registros de EcoCleaner conserva el contexto calculado. La interfaz muestra hasta doce intercambios y envía como historial los últimos tres exitosos; el servidor recupera sus textos de los intentos guardados y comprueba que corresponden al mismo contexto anonimizado. Actualizar datos o limpiar la conversación borra ese historial de la interfaz. Se puede repetir manualmente una pregunta: cuenta como otra consulta y conserva su resultado. Nunca se reintenta automáticamente.

El adaptador conserva su formato estructurado por defecto para los consumidores anteriores; solo el chat opta por texto y omite el campo de razonamiento. Se comprueban transporte, tamaño, secretos y presentación. Las referencias coincidentes se muestran, las inexistentes generan aviso y el contexto enviado queda consultable. Esa comprobación no garantiza veracidad semántica. «Otro» es una categoría indeterminada del catálogo: se muestra una aclaración cuando se menciona un producto con esa regla, sin atribuirle todas las sustancias.

Se hicieron únicamente dos llamadas reales para comprobar este cambio, con tareas sintéticas aisladas y catálogo de demostración. Ambas recibieron HTTP 200: listado de incompatibilidades y seguimiento con una operación general (7 por 8 = 56). Uso reportado: 4422 tokens. La segunda respuesta interpretó en exceso la categoría «otro»; se conserva íntegra y se añadió la aclaración determinista, comprobada localmente. No se repitió para reemplazarla ni se presenta la calidad general como garantizada. Evidencias: `D:\ECOCLEANER\evidencias\groq-chat-local\2026-10-16`.

La sesión mantiene el historial anterior: 36681 de 40000 tokens utilizados o reservados y 16 de 100 consultas. Las reservas sin uso reportado siguen contabilizadas. El perfil de texto reserva hasta 768 tokens de salida; el resto de límites confirmados no cambió. No hay reintentos automáticos ni publicación. Los resultados del formato estructurado documentados más abajo son históricos.

Después de la autorización expresa para enviar datos operativos anonimizados, el lanzador puede servir Vite y el backend en el mismo origen, exclusivamente en loopback:

```powershell
powershell -NoProfile -File .\scripts\groq-live-local\start.ps1 -App -AllowAppData -ResumeDirectory "D:\ECOCLEANER\evidencias\groq-real-local\2026-10-16\run-2026-10-17T01-51-16-420Z-a35aab"
```

Abrir `http://127.0.0.1:5173/`, iniciar sesión como supervisor y entrar al asistente. Este modo requiere el lanzador; `npm run dev` por sí solo conserva el demo. La opción `VITE_LOCAL_LLM` solo es una marca de interfaz en desarrollo y nunca contiene una clave. Los builds de producción conservan el demo. No se cambia el login, JWT, RLS ni la Edge Function.

El asistente reúne tareas cargadas, recetas, consumos, procedencia, resultados de limpieza, desvíos, comparación de variantes por tarea, decisiones de efluente y reglas del catálogo. No hay selector de escenarios. Se actualiza al entrar y mediante **Actualizar datos**. Los nombres operativos y los UUID permanecen en el navegador; el servidor solo admite la proyección de aliases, categorías y campos numéricos/enumerados permitidos. Los nombres escritos en la pregunta que coinciden con las referencias cargadas también se sustituyen. No introducir información privada en el texto libre.

El servidor vuelve a utilizar el constructor de resultados basado en core y `detectarIncompatibilidades`. Las diferencias entre consumos se calculan solo sobre tareas pareadas con receta y consumo unívoco, con presentación decimal explícita. No se cambian fórmulas del core. Las decisiones registradas no autorizan descargas y no se inventa una medición de pH del efluente. No hay fechas, costos ni causas verificadas en esta carga.

Se mantiene un resumen global de lo cargado. Si el presupuesto no permite todo el detalle, se priorizan referencias mencionadas y alertas, y se declara la cobertura parcial. No equivale a conocer toda la base de datos ni los valores de formularios sin guardar. Los límites de carga siguen siendo 200 tareas y 50 productos, con relaciones acotadas. El botón de explicar envía una pregunta real; las preguntas sugeridas solo rellenan el campo. No hay generación al abrir una pantalla.

El presupuesto combinado usa `js-tiktoken` con las reglas BPE `o200k_base` sobre el cuerpo serializado y margen adicional. Es una estimación del encuadre del proveedor, no un conteo certificado. El uso efectivo se obtiene de Groq; si supera la reserva, se contabiliza y se detiene la sesión. El adaptador anterior conserva el presupuesto por bytes como valor predeterminado. [Fuente de las reglas base y Harmony](https://github.com/openai/tiktoken/blob/main/tiktoken_ext/openai_public.py).

Una ampliación aprobada se introduce solo por servidor con `-AuthorizedTokenBudget`. Se registra sin modificar los intentos ni reiniciar consumos y se conserva al reanudar; no aumenta la cuota diaria confirmada. El navegador no puede habilitar permisos o ampliar presupuestos por JSON. Una solicitud sin uso reportado conserva su reserva.

Un HTTP 400 revisado después de conexiones anteriores válidas puede reanudarse una vez con `-ReviewedConfigurationFix`, tras guardar revisión FAIL y reserva comprobable. La autorización de esa recuperación queda ligada a los intentos conservados. Una primera conexión fallida o errores de autenticación, cuota o red siguen sin permitir esa recuperación. No se repiten preguntas fallidas.

Los primeros cinco intentos integrados conservaron dos respuestas HTTP 200 rechazadas por el validador y tres HTTP 400. Tras la autorización expresa de hasta 30000 tokens y dos llamadas nuevas, el perfil `combined_app_v5_output_1024` recibió dos HTTP 200: una respuesta aprobada sobre procedencia simulada y otra con contrato técnico válido pero revisión semántica FAIL. La segunda confundió una alerta de dosis con evidencia de limpieza y añadió una recomendación no respaldada. Se conservó sin corregir y se añadió una regresión para rechazar el infinitivo incorrecto de vertido que el filtro había omitido. Su reproducción local ahora se rechaza, sin otra llamada al proveedor. La calidad general sigue pendiente.

El acumulado de las fases es 13667 tokens reportados y 11228 reservados por solicitudes sin uso reportado: 24895 de los 30000 autorizados. Quedan 5105 tokens, pero se alcanzó el máximo autorizado de once generaciones; el envío está bloqueado y el demo sigue disponible. Hubo además un bloqueo local por minuto que no llamó al proveedor ni aumentó el contador. Las pruebas de interfaz con transporte simulado están rotuladas y no acreditan Groq real. Evidencias: `D:\ECOCLEANER\evidencias\groq-app-local\2026-10-16`.

Esta copia no contiene configuración local de Supabase: usa los registros guardados en el navegador y el catálogo simulado. La integración admite la lectura ya existente cuando se configure Supabase, pero no se transmitieron registros de producción durante estas pruebas.

El perfil integrado reserva hasta 1024 tokens de salida dentro del mismo límite por minuto, conserva el esfuerzo `low` y registra únicamente metadatos de estructura si Groq devuelve `failed_generation`. No guarda su texto ni razonamiento. Las dos llamadas nuevas evitaron el error de formato, pero no demuestran que la causa anterior fuese el espacio de salida. Se conserva el esquema original y la validación de servidor; un PASS técnico no garantiza fidelidad semántica.

## Preparación

Requiere Windows, Windows PowerShell 5.1 o PowerShell 7, Node 24 y las dependencias del repositorio. Los imports TypeScript se resuelven con un hook local; no se instalan modelos. El modo integrado utiliza la dependencia de desarrollo `js-tiktoken`.

1. Crear una clave en [la consola de Groq](https://console.groq.com/keys).
2. Comprobar el plan gratuito y los límites reales de `openai/gpt-oss-20b` en la cuenta. Los límites publicados son orientativos; la confirmación se realiza en la consola de la cuenta. No activar facturación.
3. Desde la raíz del proyecto, ejecutar:

```powershell
powershell -NoProfile -File .\scripts\groq-live-local\configure.ps1
```

El script solicita la confirmación del plan, RPM/RPD/TPM/TPD y el presupuesto de tokens disponible autorizado. La clave se introduce mediante `SecureString` y se guarda cifrada con DPAPI en `%LOCALAPPDATA%\EcoCleaner\groq-live-local\groq-key.dpapi`, fuera del repositorio. `account.json` contiene la confirmación y límites, sin la clave. No pegar credenciales en el chat ni crear variables `VITE_` con secretos.

```powershell
powershell -NoProfile -File .\scripts\groq-live-local\start.ps1
```

El lanzador descifra la clave solo para el entorno del proceso servidor y restaura el entorno al terminar. Antes de abrir la interfaz se consulta `GET /openai/v1/models`: verifica autenticación y disponibilidad, sin generar texto. Esto no verifica por API el plan de facturación; ese dato depende de la confirmación del titular. Un error de conexión, modelo o configuración detiene el inicio.

El perfil local utiliza instrucciones breves exclusivas de servidor, esfuerzo de razonamiento `low` y hasta 768 tokens de salida. Conserva los validadores originales. Las opciones nuevas son optativas: los consumidores anteriores del explicador mantienen su mensaje y configuración por defecto. El perfil y el mensaje efectivos se guardan en los metadatos de la sesión; cada cambio de perfil conserva las evidencias anteriores.

## Preguntas y contexto

Abrir `http://127.0.0.1:5187/`, elegir un contexto y escribir una pregunta nueva. Los 15 escenarios anteriores se recalculan mediante core durante la ejecución. Solo se proyecta `input.context`; las respuestas simuladas y los criterios esperados de la batería nunca se incluyen en el prompt. Se pueden introducir preguntas ajenas a las nueve categorías del demo.

Todos los productos, reglas y registros de esos contextos son ficticios. Las marcas manuales son escenarios de evaluación y no mediciones físicas. No se carga Supabase, no se permiten contextos arbitrarios enviados desde el navegador y no se realizan escrituras externas. Una pregunta sobre otras áreas, periodos o causas ausentes debe reconocer esa falta de información.

La interfaz muestra la explicación validada, las referencias a los hechos calculados, las limitaciones y una sección con el contenido exacto devuelto por el proveedor. Una respuesta descartada se identifica como tal: cualquier respaldo está rotulado como texto del sistema. No hay historial utilizado como contexto ni reintentos automáticos.

## Seguridad y presupuesto

- Escucha exclusivamente en `127.0.0.1`; comprueba Host y origen exactos. Las rutas de datos requieren una cookie aleatoria HttpOnly/SameSite=Strict. No habilita CORS público.
- La política CSP limita las conexiones del navegador al mismo servidor. La llamada a Groq ocurre en Node, con la clave en una cabecera que nunca llega al navegador.
- Solo admite pregunta y escenario sintético. Rechaza secretos aparentes, correos, URLs, HTML, tamaños excesivos y campos adicionales. Son filtros parciales; no introducir información privada en el texto libre.
- Por defecto, 11 generaciones por sesión; esta sesión tiene ampliación expresa a 100. Una solicitud activa y sin repeticiones automáticas. Se reserva entrada más hasta 768 tokens de salida. Cuando Groq devuelve uso válido y coherente se libera únicamente la reserva sobrante; si falta se conserva completa. Se respetan los límites confirmados y las cuotas del proveedor.
- El conteo previo por bytes es el del adaptador existente, no un tokenizador real. El uso efectivo se toma de la respuesta de Groq. No cambiar de modelo o proveedor ni activar facturación automáticamente.
- Si la primera generación falla, se conserva su resultado y se bloquean nuevas generaciones. Los errores de autenticación o cuota también detienen la sesión. No reiniciar el ejecutor para ocultar un fallo ni para superar el presupuesto autorizado.
- La confirmación de cuenta caduca después de 24 horas. No iniciar sesiones concurrentes ni ignorar el consumo de otras aplicaciones de la misma organización.

Una sesión con HTTP 200 y uso de tokens verificable puede reanudarse con `start.ps1 -ResumeDirectory <carpeta-run>`, después de registrar la revisión de cualquier fallo. Se conservan los intentos, consumos y preguntas ya utilizadas; no se permite repetirlas ni ampliar el presupuesto sin autorización expresa. La reanudación rechaza errores de conexión, autenticación o cuota del proveedor. Es para probar preguntas diferentes después de revisar un resultado, no para reemplazar una respuesta fallida. Cada reanudación añade metadatos nuevos sin sobrescribir los originales.

## Evidencias y evaluación

Se guardan fuera del repositorio en `../evidencias/groq-real-local/<fecha>/run-...`:

- `preflight.json`: operación de consulta de modelos, estado HTTP y tiempo, sin generación.
- `session.json`: modelo, proveedor, confirmación de límites y procedencia sintética.
- `<id>.json`: pregunta, contexto calculado, hechos permitidos, respuesta exacta de contenido, HTTP, tiempo, ID del proveedor, uso real de tokens y validación técnica.
- `<id>.review.json`: evaluación manual PASS/FAIL y motivo, separada de la respuesta original.

No se guardan cabeceras Authorization, claves, JWT, razonamiento interno del modelo ni mensajes privados de error del proveedor. Una respuesta con un posible secreto se retiene sin guardar su contenido. Las evidencias de transporte no certifican calidad semántica.

La revisión de calidad debe comprobar fidelidad, cifras, unidades, evidencias, procedencia, causas no demostradas, limitaciones, español y recomendaciones. Un PASS técnico puede ser FAIL de calidad. Las pruebas unitarias del ejecutor usan transporte simulado, se identifican con `realProvider: false` y no acreditan llamadas reales.

```powershell
node --import ./scripts/groq-live-local/register.mjs --test ./scripts/groq-live-local/server.test.mjs
npm test --workspaces --if-present
npm run lint --workspaces --if-present
npm run build --workspaces --if-present
```

Finalizar con **Cerrar el ejecutor local** o Ctrl+C. Solo se cierran los procesos creados para esta validación. Para conectar después el Dashboard con Groq siguen pendientes Supabase Auth, autorización por recurso, cuotas distribuidas, autorización del contexto real y un despliegue revisado. Este ejecutor no sustituye esos controles ni habilita la Edge Function.

## Resultado observado: 16 de octubre de 2026

Se hicieron cuatro generaciones reales con `openai/gpt-oss-20b`, cada una con una pregunta diferente y contexto sintético calculado por core. Todas recibieron HTTP 200; no hubo reintentos de generación. El proveedor reportó 1936 tokens de entrada y 1014 de salida: 2950 en total, dentro del presupuesto local autorizado de 10000. Los tiempos observados estuvieron entre 540 y 977 ms.

| Contexto                                   | Contrato | Calidad del contenido y trazabilidad                                                                                                                                                               |
| ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Incompatibilidades, pregunta inicial libre | FAIL     | FAIL: categoría atribuida sin respaldo, referencias por URL y limitaciones vacías                                                                                                                  |
| Desvío y causa de consumo                  | FAIL     | FAIL: cifras redondeadas e inferencia causal sin evidencia                                                                                                                                         |
| Variantes con información insuficiente     | PASS     | PASS: reconoce ausencia de datos y no elige una variante inexistente                                                                                                                               |
| Volúmenes de receta                        | FAIL     | Las cifras principales son correctas; falla por limitaciones vacías y un valor sin su referencia numérica. El filtro de verbos también produce un rechazo conservador de una narración descriptiva |

No se concluye que el modelo esté listo para producción. Las instrucciones compactas mejoraron la referencia a claves en las pruebas posteriores, pero no garantizaron fidelidad ni cumplimiento completo. Los validadores conservaron sus reglas y descartaron las salidas inválidas; la revisión semántica detectó problemas adicionales. El filtro textual tiene falsos positivos que también requieren revisión. Los once escenarios restantes no se ejecutaron: se detuvo la evaluación acotada después de cuatro preguntas, sin buscar una respuesta satisfactoria repitiéndolas.

Las respuestas exactas, preguntas, contextos, IDs de Groq, uso de tokens, evaluaciones, capturas, red del navegador y cuatro videos se conservan fuera del repositorio en `D:\ECOCLEANER\evidencias\groq-real-local\2026-10-16`. El primer fallo se mantuvo al reanudar la misma sesión para preguntas nuevas; se conservaron sus consumos y el presupuesto original. No se enviaron registros reales ni se desplegó ningún endpoint. El informe completo de la ejecución está en esa carpeta.
