# Guía de contribución

Gracias por contribuir a EcoCleaner. Esta guía describe las convenciones del proyecto para
mantener el repositorio consistente y facilitar la revisión.

## Idioma

- **Código en inglés:** identificadores de variables, funciones, componentes, tipos y
  archivos de lógica.
- **Comentarios y texto de interfaz en español:** todo lo que lee una persona (comentarios,
  etiquetas, mensajes, alertas) va en español.

## Ramas

Usa ramas cortas con un prefijo que describa el tipo de trabajo:

| Prefijo   | Uso                                                               |
| --------- | ----------------------------------------------------------------- |
| `feat/…`  | Nueva funcionalidad                                               |
| `fix/…`   | Corrección de un error                                            |
| `chore/…` | Tareas de mantenimiento que no cambian el código de la aplicación |
| `docs/…`  | Cambios solo de documentación                                     |

Ejemplo: `feat/operario-receta`, `fix/desvio-sobredosis`, `docs/readme-contributing-conventions`.

## Commits

Seguimos [Conventional Commits](https://www.conventionalcommits.org/). El mensaje tiene la
forma:

```
<tipo>[scope opcional]: <descripción>

[cuerpo opcional]

[footer opcional]
```

- El **tipo** va en minúscula, seguido de dos puntos y un espacio.
- El **scope** (opcional) describe la sección afectada, entre paréntesis: `feat(core):`,
  `fix(web):`.
- La **descripción** es breve y en imperativo.
- El **cuerpo**, si existe, empieza una línea en blanco después de la descripción.

### Tipos

| Tipo       | Uso                                                             |
| ---------- | --------------------------------------------------------------- |
| `feat`     | Nueva funcionalidad                                             |
| `fix`      | Corrección de un error                                          |
| `docs`     | Cambios solo de documentación                                   |
| `style`    | Formato que no altera el significado del código                 |
| `refactor` | Cambio de código que no corrige un error ni añade funcionalidad |
| `perf`     | Mejora de rendimiento                                           |
| `test`     | Añadir o corregir pruebas                                       |
| `build`    | Cambios del sistema de build o dependencias                     |
| `ci`       | Cambios de la configuración de integración continua             |
| `chore`    | Otras tareas que no modifican código fuente ni pruebas          |
| `revert`   | Revertir un commit anterior                                     |

### Cambios rompientes

Un cambio incompatible con versiones anteriores se indica con `BREAKING CHANGE:` al inicio
del cuerpo o del footer, seguido de una descripción de qué cambió.

## Pull requests

- Un pull request por tarjeta del tablero.
- Usa la plantilla de `.github/pull_request_template.md` (qué cambia, cómo se probó, ticket).
- Requiere **una aprobación** y el **CI en verde** antes del merge.

## Protección de `main`

- La rama `main` está protegida: **nunca** se hace push directo.
- Todo cambio entra por pull request desde una rama corta.
- El merge requiere el **CI en verde** y **una aprobación**.

## Integración continua (CI/CD)

El repositorio usa **GitHub Actions** con el flujo `.github/workflows/ci.yml`, que se ejecuta
en **cada pull request** y en **cada push a `main`**. Sus pasos son, por workspace
(`--if-present`):

1. `npm ci`
2. `lint`
3. `build`
4. `test`

El **despliegue** es continuo en **Vercel**: cada pull request genera una vista previa y la
rama `main` publica la versión de producción.

## Pruebas

Antes de abrir un pull request, reproduce el CI en local:

```bash
npm run lint  --workspaces --if-present
npm run build --workspaces --if-present
npm test      --workspaces --if-present
```

No se mergea ningún cambio con el CI en rojo.

## Alcance de carpetas

- Cada persona trabaja en su carpeta de feature (`features/operario`, `features/supervisor`).
- Los cambios en `App.tsx`, `MobileLayout.tsx` y `components/ui` afectan a todo el equipo:
  se coordinan o se envían en un pull request pequeño aparte.

## Formato

El formato del código se define con **Prettier** y es único para todo el repositorio:

- Indentación de 2 espacios.
- Comillas simples.
- Sin punto y coma.

El formato se aplica a **código nuevo**. Indica siempre los archivos, para no reformatear el
legado de forma accidental. Para dar formato:

```bash
npm run format -- apps/web/src/features/operario
```

Para comprobar que unos archivos cumplen el formato:

```bash
npm run format:check -- apps/web/src/features/operario
```
