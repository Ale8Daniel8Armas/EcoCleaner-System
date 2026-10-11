# EcoCleaner

[![CI](https://github.com/Ale8Daniel8Armas/EcoCleaner-System/actions/workflows/ci.yml/badge.svg)](https://github.com/Ale8Daniel8Armas/EcoCleaner-System/actions/workflows/ci.yml)

Aplicación web móvil (PWA) que ayuda a preparar la mezcla correcta, registrar lo que
realmente se usa, comprobar si la limpieza cumplió su criterio, recomendar el
procedimiento de menor consumo que sí funciona y orientar qué hacer con el efluente.

- **Evento:** Hackatón Expo Clean 2026 — Reto 4
- **Reto:** optimización y neutralización del impacto ambiental en el uso de agua y vertido de residuos químicos
- **Tipo de producto:** prototipo funcional (PWA con base de datos)
- **Demo:** https://eco-cleaner-system.vercel.app

## Problema y objetivo

En la limpieza industrial el agua y los productos químicos suelen usarse sin medir: las
soluciones se preparan "a ojo" y casi nunca se registra cuánto se usó ni si la limpieza
cumplió su objetivo. EcoCleaner reduce el consumo evitable en origen sin perder calidad, y
da trazabilidad y orientación sobre el efluente.

El software **orienta, previene y documenta**; no neutraliza físicamente el efluente. No se
prometen porcentajes de ahorro: se muestran los resultados de una prueba controlada propia
declarada como muestra pequeña.

## Alcance

El alcance inicial es el lavado de pisos y superficies industriales **no críticas** (bodegas,
almacenes logísticos y zonas de tránsito de plantas). No cubre superficies donde la eficacia
sanitaria es crítica, como hospitales.

### P0 (obligatorio, de punta a punta)

- Catálogo de productos con dilución, pH de la ficha e incompatibilidades.
- Receta: litros de agua y ml de producto según m², superficie y suciedad.
- Registro de agua y producto usados, tiempo, y marca "medido" o "estimado".
- Criterio de limpieza (cumple / no cumple) definido por el supervisor.
- Comparación de variantes: solo cuentan las que cumplen; se recomienda la de menor consumo.
- Alertas de sobredosis y de mezclas incompatibles.
- Guía de efluente: verter / ajustar / reutilizar / gestor autorizado.
- Panel del supervisor y reporte imprimible.
- Esquema de datos multisitio (sitios y áreas).

### P1 (solo si el P0 está estable)

Simulador de fuga, QR por área y explicador con LLM (nunca en el camino crítico).

### Fuera de alcance

Sensores reales de caudal o pH, dosificadores automáticos, neutralización física del
efluente, certificación de ahorros, autenticación real, modo sin conexión y foto con IA.

Más detalle en [`docs/alcance.md`](./docs/alcance.md).

## Usuarios y roles

| Perfil     | Qué hace                                                                                      | Dispositivo          |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------- |
| Operario   | Consulta la receta, registra consumo y resultado, y revisa la guía de efluente.               | Celular, en terreno  |
| Supervisor | Crea sitios y áreas, define criterios, revisa el panel y la comparación, y genera el reporte. | Celular o computador |
| Cliente    | Recibe el reporte impreso o en PDF (fuera del sistema).                                       | No aplica            |

En el prototipo no hay inicio de sesión: un selector de rol permite entrar como operario o
supervisor, con navegación distinta por rol.

## Equipo y roles

| Rol                         | Responsabilidades principales                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Líder técnico e integración | Repositorio, CI y despliegue, esquema y migraciones, revisión de PR y control de alcance.       |
| Backend y dominio           | `packages/core` con pruebas, consultas y agregados para panel y reporte, función del LLM (P1).  |
| Frontend operario           | Receta, registro de uso, criterio de limpieza, guía de efluente, PWA y QR (P1).                 |
| Frontend supervisor         | Sitio desde plantilla, panel, comparación, reporte imprimible y simulador de fuga (P1).         |
| QA, datos y documentación   | Catálogo de productos, mini-prueba, plan de pruebas, README, diagrama y bitácora de decisiones. |

## Arquitectura

| Capa                 | Tecnología                        | Responsabilidad                                                                                  |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Frontend             | React + Vite + TypeScript (PWA)   | Pantallas de operario y supervisor, navegación móvil, reporte imprimible.                        |
| Lógica de dominio    | `packages/core` (TypeScript puro) | Receta, desvío, comparación, incompatibilidades y efluente, sin dependencia de UI ni de la base. |
| Contratos            | `packages/schemas` (Zod)          | Validación y tipos compartidos entre frontend y backend.                                         |
| Datos y backend      | Supabase (PostgreSQL)             | Tablas, restricciones, migraciones y políticas RLS de demostración.                              |
| Despliegue y calidad | Vercel + GitHub Actions           | Enlace público, vista previa por PR y CI con lint, build y pruebas.                              |

Los cálculos y las alertas de seguridad se resuelven en el código (`packages/core`), nunca en
el LLM. Ninguna receta puede salir del rango de dilución de la ficha del fabricante.

## Requisitos

- Node.js 22
- npm
- (Opcional) Supabase CLI para trabajar con la base local

## Puesta en marcha

```bash
# 1. Instalar dependencias
npm ci

# 2. Compilar los contratos compartidos
npm run build --workspace @ecocleaner/schemas

# 3. Ejecutar la aplicación web
npm run dev

# 4. Ejecutar las pruebas del dominio
npm test --workspace @ecocleaner/core
```

## Variables de entorno

La aplicación web usa Supabase a través de variables de entorno. Copia el ejemplo y completa
los valores de tu proyecto:

```bash
cp apps/web/.env.example apps/web/.env
```

```
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=TU_CLAVE_PUBLICA
```

El archivo `.env` no se versiona. La clave `service_role` no se usa ni se sube al repositorio.

## Scripts

| Comando                                         | Descripción                                    |
| ----------------------------------------------- | ---------------------------------------------- |
| `npm run dev`                                   | Inicia la aplicación web en modo desarrollo.   |
| `npm run build --workspace @ecocleaner/schemas` | Compila los esquemas Zod y sus tipos.          |
| `npm test --workspace @ecocleaner/core`         | Ejecuta las pruebas del dominio.               |
| `npm run lint --workspace web`                  | Analiza el código de la aplicación web.        |
| `npm run build --workspace web`                 | Compila la aplicación web para producción.     |
| `npm run preview --workspace web`               | Sirve la compilación de producción localmente. |

## Estructura del repositorio

```
ecocleaner/
├── apps/
│   └── web/                     # Aplicación React + Vite (PWA)
│       └── src/
│           ├── app/             # Router y layouts (MobileLayout)
│           ├── features/        # Pantallas por rol
│           │   ├── operario/
│           │   └── supervisor/
│           ├── components/ui/   # Componentes de interfaz compartidos
│           └── services/        # Acceso a datos (un archivo por entidad)
├── packages/
│   ├── core/                    # Lógica de dominio pura y pruebas
│   └── schemas/                 # Esquemas Zod y tipos compartidos
├── supabase/
│   └── migrations/              # SQL versionado
└── docs/                        # Alcance, catálogo y arquitectura
```

Los componentes de interfaz no llaman a Supabase directamente: usan `services/`. La lógica
de negocio se importa de `@ecocleaner/core`.

## Dominio (`packages/core`)

Funciones puras y probadas. Usan los tipos de `@ecocleaner/schemas` y no acceden a la base.

| Función            | Propósito                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| Receta             | Calcula litros de solución, ml por litro, ml de producto y litros de agua para una tarea.                    |
| Desvío             | Compara el consumo real con la receta y marca sobredosis respecto a la tolerancia y al máximo de la ficha.   |
| Comparación        | Descarta las variantes que no cumplen el criterio y recomienda la de menor consumo con su tamaño de muestra. |
| Incompatibilidades | Detecta mezclas incompatibles a partir de las categorías y reglas del catálogo.                              |
| Efluente           | Orienta la disposición (verter, ajustar, reutilizar, gestor o no disponible) de forma conservadora.          |

## Modelo de datos

Base de datos PostgreSQL en Supabase. Todas las tablas tienen `id` (uuid) y `created_at`.
Relaciones: sitio 1-N área 1-N tarea; producto 1-N tarea; tarea 1-N variante; tarea 1-N
registro de uso; registro 1-1 resultado 1-1 decisión de efluente.

| Tabla                 | Campos principales                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `sitios`              | nombre, tipo, criterios_limpieza                                                                              |
| `areas`               | sitio_id, nombre, superficie_m2, tipo_superficie, litros_solucion_por_m2                                      |
| `productos`           | nombre, categorías, incompatibilidades, dilución mín/recomendada/máx, pH, enlaces a ficha y hoja de seguridad |
| `tareas`              | area_id, producto_id, nivel_suciedad, litros_solucion_esperados, ml_producto_esperados                        |
| `variantes`           | tarea_id, nombre, dilucion_ml_por_litro, repeticiones                                                         |
| `registros_uso`       | tarea_id, variante_id, litros_agua_reales, ml_producto_reales, duracion_min, marca, fuente, alerta_sobredosis |
| `resultados`          | registro_uso_id, cumple_criterio, criterios_evaluados                                                         |
| `decisiones_efluente` | resultado_id, orientacion, decision_final, ph_estimado                                                        |

Los cambios al modelo se hacen con migraciones nuevas en `supabase/migrations`, nunca
editando a mano en el panel.

## Rutas y pantallas

| Ruta                       | Pantalla                    | Perfil     | Prioridad |
| -------------------------- | --------------------------- | ---------- | --------- |
| `/`                        | Inicio y selección de rol   | Ambos      | P0        |
| `/operario`                | Inicio del operario         | Operario   | P0        |
| `/operario/receta`         | Receta de la tarea          | Operario   | P0        |
| `/operario/registro`       | Registro de uso y alertas   | Operario   | P0        |
| `/operario/criterio`       | Criterio de limpieza        | Operario   | P0        |
| `/operario/efluente`       | Guía de efluente y decisión | Operario   | P0        |
| `/supervisor`              | Inicio del supervisor       | Supervisor | P0        |
| `/supervisor/sitios/nuevo` | Crear sitio desde plantilla | Supervisor | P0        |
| `/supervisor/panel`        | Panel de consumo            | Supervisor | P0        |
| `/supervisor/comparacion`  | Comparación de variantes    | Supervisor | P0        |
| `/supervisor/reporte`      | Reporte imprimible          | Supervisor | P0        |

## Datos de demostración

El catálogo del prototipo reúne productos con ficha técnica y hoja de seguridad, con
variedad de categorías para demostrar las incompatibilidades. Todo dato simulado se guarda
con fuente "simulada" y se rotula en la interfaz; no se presenta como evidencia de ahorro.

La plantilla de carga está en [`docs/catalogo-plantilla.json`](./docs/catalogo-plantilla.json).

## Despliegue

La aplicación se despliega en Vercel con reescritura de rutas para SPA
(`apps/web/vercel.json`). Cada pull request ejecuta lint, build y pruebas mediante GitHub
Actions, y el merge requiere el CI en verde.

## Limitaciones y descargos

- **RLS de demostración:** las políticas de seguridad por filas están abiertas; es una
  limitación declarada, no seguridad de producción.
- **Autenticación:** no hay inicio de sesión real ni políticas por usuario en el prototipo.
- **IA (P1):** el explicador con LLM está fuera del camino crítico y solo narra datos ya
  calculados; si falla, se muestra un texto plantilla.
- **Sin sensores:** todas las mediciones son autodeclaradas por el operario.
- **Seguridad química:** el dominio valida lógica de software; no certifica seguridad química
  ni ahorro real. Las fichas y límites deben revisarse antes de usar datos reales.

## Contribuir

Las convenciones del proyecto (idioma, ramas, commits, pull requests, formato y pruebas)
están en [`CONTRIBUTING.md`](./CONTRIBUTING.md). Los cambios entran siempre por rama y pull
request; la rama `main` está protegida.

## Referencias

- [`docs/alcance.md`](./docs/alcance.md) — alcance del prototipo.
- [`docs/backend-core.md`](./docs/backend-core.md) — dominio P0 y verificación.
- [`docs/catalogo-plantilla.json`](./docs/catalogo-plantilla.json) — plantilla de catálogo.
- Especificación de Requisitos de Software (ERS) v1.0 — documento del equipo.
