# Asistente Groq en producción

El backend de este PR es una Vercel Function en `apps/web/api/app/[action].ts`.
Conserva el adaptador, el contrato de análisis, los filtros y el constructor de
contexto existentes. No utiliza el servidor HTTP ni los archivos de sesión de la
laptop en producción. Tampoco modifica fórmulas, tablas del dominio, sus RLS ni
el login actual de EcoCleaner.

`npm run build` comprueba los tipos del backend y compila sus módulos compartidos
con Vite SSR a `apps/web/server/llm-production.mjs`. La función importa ese
JavaScript generado, sin volver a transpilar cada archivo TypeScript del dominio
con la configuración del runtime. El archivo generado se excluye de Git y del
directorio público `dist`; la declaración de tipos sí se versiona. No requiere
variables privadas para compilar. CI comprueba también que el módulo generado y
el entrypoint se pueden cargar sin hacer llamadas externas.

## Activación a cargo del líder

1. Aplicar **solo** `supabase/migrations/20261017150000_llm_production_quota.sql`
   al proyecto que ya utiliza la aplicación. No reaplicar migraciones históricas.
   Las dos tablas nuevas quedan cerradas a `anon` y `authenticated`; sus RPC solo
   se ejecutan con la credencial secreta de servidor. La cuota comienza cerrada.
2. Crear o identificar la cuenta real del supervisor en **Supabase Auth**. No
   basta un registro en la tabla demo `usuarios`. El responsable del proyecto
   debe asignarle `app_metadata.ecocleaner_role = "supervisor"` con una operación
   administrativa. No usar `user_metadata`, que puede editar el propio usuario.
   La contraseña se configura directamente con Auth; no se pega en el chat ni en Git.
3. Congelar e importar el consumo existente según la sección siguiente. No
   mantener simultáneamente el ejecutor local y el público gastando el mismo saldo.
4. Configurar las variables de Vercel indicadas abajo, en **Production**. Verificar
   en la cuenta de Groq el plan y límites antes de aprobar las llamadas: este
   ejecutor limita cada solicitud a 8000 tokens, el uso combinado a 8000 tokens
   por minuto y las solicitudes a 10 por minuto. El proveedor puede imponer
   límites menores y sus errores detienen la sesión; no hay reintentos.
5. Integrar el PR mediante el proceso de revisión del equipo y desplegar desde
   `main`. La raíz del proyecto Vercel sigue siendo `apps/web`. El runtime debe
   ser Node 24. No añadir una regla que reescriba `/api/*` al HTML de la SPA.
6. Abrir `/supervisor/asistente`, entrar con el login existente y completar el
   acceso seguro del asistente con la cuenta Auth autorizada. Esa sesión es
   independiente, reside en memoria y debe renovarse cuando expire o se recargue
   la página. No altera la sesión de las demás pantallas.
7. Comprobar `GET /api/app/state` autenticado: debe recuperar el presupuesto y el
   consumo importados. Una petición sin token debe devolver 401, nunca HTML ni
   información del consumo. Abrir la pantalla o consultar estado no llama al modelo.
   Cualquier prueba de generación real requiere autorización específica y descuenta
   del mismo saldo. Las pruebas de este PR usan exclusivamente transporte simulado.

## Variables de Vercel

| Variable                      | Ubicación            | Valor / propósito                                                                      |
| ----------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| `VITE_PRODUCTION_LLM`         | Compilación frontend | `true` para mostrar el acceso seguro; no concede autorización                          |
| `VITE_LLM_MODE`               | Compilación frontend | `demo` conserva la vista y la alternativa sin IA; `off` oculta el asistente            |
| `VITE_SUPABASE_URL`           | Compilación frontend | URL existente del proyecto                                                             |
| `VITE_SUPABASE_ANON_KEY`      | Compilación frontend | Clave pública `anon` o publishable, nunca una clave secreta                            |
| `SUPABASE_URL`                | Servidor             | Mismo proyecto Supabase                                                                |
| `SUPABASE_ANON_KEY`           | Servidor             | Clave pública para verificar el JWT con Auth                                           |
| `SUPABASE_SERVICE_ROLE_KEY`   | Servidor, secreta    | Credencial `service_role` o nueva secret key para cuota y auditoría privadas           |
| `GROQ_API_KEY`                | Servidor, secreta    | Clave de Groq configurada directamente en Vercel                                       |
| `LLM_ALLOWED_ORIGIN`          | Servidor             | `https://eco-cleaner-system.vercel.app`, sin barra final; usar el dominio público real |
| `LLM_PRODUCTION_ENABLED`      | Servidor             | `true` solo después de configurar identidad, cuota y secretos                          |
| `LLM_EXTERNAL_CALLS_APPROVED` | Servidor             | `true` tras confirmar el procesamiento externo de la proyección anonimizada            |

No poner las credenciales secretas en variables `VITE_`. No copiar el archivo
DPAPI de otra computadora ni subir `.env`, cookies o archivos de evidencia a Git.
Las vistas previas pueden conservar el demo con `VITE_PRODUCTION_LLM=false` y el
backend cerrado; no añadir automáticamente sus dominios al origen autorizado.

## Importación única del consumo y conservación del saldo

El presupuesto autorizado sigue siendo **80000 tokens y 100 consultas**. En el
traspaso había **73706 utilizados o reservados, 32 consultas y 6294 tokens de
saldo**. Son cifras históricas: antes de activar hay que exportar el estado vivo,
incluidas las consultas manuales posteriores. No autoriza un presupuesto nuevo.

Desde la laptop que mantiene el ejecutor original, con Node 24 y el código de
este PR. Antes de exportar, reiniciar el lanzador actualizado conservando el mismo
`ResumeDirectory`; no crear una sesión nueva:

```powershell
node scripts/groq-production/export-budget.mjs --stop-local --output D:\evidencias\llm-production-baseline.sql
```

El script lee el estado, rechaza una consulta activa, congela de forma atómica
las generaciones, escribe una marca de traspaso y detiene el ejecutor local
y escribe únicamente SQL con los contadores. No transmite claves ni hace una
generación. El archivo se crea sin sobrescribir otro anterior. El líder debe
aplicar ese SQL **una sola vez**, después de la migración y antes de habilitar
llamadas. La importación falla si la cuota ya está inicializada o tiene solicitudes;
no es un mecanismo para restablecer saldo. La marca impide volver a reanudar ese
historial local después de transferirlo. Los intentos y las revisiones originales
permanecen en el archivo de evidencias de la laptop y no se suben al nuevo backend.

Las reservas se contabilizan antes de llamar al proveedor, bajo bloqueo de fila.
Una función interrumpida conserva la reserva completa. La espera de una instancia
perdida expira a los dos minutos y no devuelve tokens. Solo un uso coherente
reportado por Groq libera el sobrante. Si supera la reserva, se contabiliza y se
detiene la sesión. El cambio de día, recarga o arranque en frío no reinicia el saldo.

## Identidad, datos y evidencia

El servidor comprueba el JWT contra Supabase Auth en cada petición y exige el rol
administrado de supervisor. El rol del navegador y la tabla demo `usuarios` no
autorizan llamadas. El historial solo admite respuestas válidas del mismo usuario
y con la misma huella de contexto. Las preguntas nuevas y seguimientos conservan
las reglas del conversatorio existente.

La carga es la proyección anonimizada del navegador, validada y calculada de nuevo
por el constructor de contexto del servidor; no es una lectura independiente de
toda la base ni una certificación de datos enviados por el usuario. Se conserva
la procedencia y la identificación del escenario simulado. No añadir usuarios,
correos, observaciones ni campos no admitidos a ese contrato.

Las nuevas tablas guardan pregunta anonimizada, resultado validado o rechazo,
huella, uso y metadatos del proveedor. No guardan la clave, JWT, contraseña,
razonamiento privado ni mensajes internos de error de Groq. Las respuestas
rechazadas no se presentan como respuestas válidas ni se sustituyen por un demo
atribuido al modelo.

## Verificación y cierre

```powershell
npm test --workspaces --if-present
npm run build --workspaces --if-present
npm run lint --workspaces --if-present
```

Las pruebas nuevas ejecutan la migración en PostgreSQL embebido y comprueban
permisos, reservas, caída de instancia, doble finalización y conservación del
consumo. Las pruebas HTTP usan Auth y Groq simulados, con rechazo de peticiones
anónimas, rol no administrado, origen ajeno, historial ajeno y saldo insuficiente.
Las pruebas de transporte simulado no acreditan una llamada real ni calidad de
producción del modelo.

Para suspender llamadas sin borrar evidencia, poner `LLM_PRODUCTION_ENABLED=false`
y volver a desplegar. Para volver a la interfaz demo, compilar con
`VITE_PRODUCTION_LLM=false`. No truncar tablas ni reimportar la cuota para reiniciar
consumos. Este PR no publica cambios directamente en Vercel ni Supabase: lo realiza
el líder después de la revisión.
