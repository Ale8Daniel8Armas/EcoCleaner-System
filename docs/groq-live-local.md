# Validación local de Groq

El ejecutor de `scripts/groq-live-local` reutiliza `createLLMExplainer`, el adaptador Groq, sus contratos y validadores. Ofrece una interfaz local para preguntas libres. No importa el clasificador demo ni utiliza plantillas como respuesta generada. El Dashboard y la Edge Function permanecen intactos.

## Preparación

Requiere Windows, Windows PowerShell 5.1 o PowerShell 7 y Node 24. Los imports TypeScript existentes se resuelven con un hook local; no se instalan modelos ni dependencias nuevas.

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

## Preguntas y contexto

Abrir `http://127.0.0.1:5187/`, elegir un contexto y escribir una pregunta nueva. Los 15 escenarios anteriores se recalculan mediante core durante la ejecución. Solo se proyecta `input.context`; las respuestas simuladas y los criterios esperados de la batería nunca se incluyen en el prompt. Se pueden introducir preguntas ajenas a las nueve categorías del demo.

Todos los productos, reglas y registros de esos contextos son ficticios. Las marcas manuales son escenarios de evaluación y no mediciones físicas. No se carga Supabase, no se permiten contextos arbitrarios enviados desde el navegador y no se realizan escrituras externas. Una pregunta sobre otras áreas, periodos o causas ausentes debe reconocer esa falta de información.

La interfaz muestra la explicación validada, las referencias a los hechos calculados, las limitaciones y una sección con el contenido exacto devuelto por el proveedor. Una respuesta descartada se identifica como tal: cualquier respaldo está rotulado como texto del sistema. No hay historial utilizado como contexto ni reintentos automáticos.

## Seguridad y presupuesto

- Escucha exclusivamente en `127.0.0.1`; comprueba Host y origen exactos. Las rutas de datos requieren una cookie aleatoria HttpOnly/SameSite=Strict. No habilita CORS público.
- La política CSP limita las conexiones del navegador al mismo servidor. La llamada a Groq ocurre en Node, con la clave en una cabecera que nunca llega al navegador.
- Solo admite pregunta y escenario sintético. Rechaza secretos aparentes, correos, URLs, HTML, tamaños excesivos y campos adicionales. Son filtros parciales; no introducir información privada en el texto libre.
- Máximo de 11 generaciones por sesión, una por pregunta/contexto y una solicitud activa. Se reserva un presupuesto conservador de entrada más hasta 1024 tokens de salida. Se respetan los límites confirmados y las cuotas devueltas por el proveedor.
- El conteo previo por bytes es el del adaptador existente, no un tokenizador real. El uso efectivo se toma de la respuesta de Groq. No cambiar de modelo o proveedor ni activar facturación automáticamente.
- Si la primera generación falla, se conserva su resultado y se bloquean nuevas generaciones. Los errores de autenticación o cuota también detienen la sesión. No reiniciar el ejecutor para ocultar un fallo ni para superar el presupuesto autorizado.
- La confirmación de cuenta caduca después de 24 horas. No iniciar sesiones concurrentes ni ignorar el consumo de otras aplicaciones de la misma organización.

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
