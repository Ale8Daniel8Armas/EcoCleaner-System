# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Supervisor: pantallas y componentes UI

Las rutas P0 del supervisor son:

- `/supervisor` y `/supervisor/panel`: panel de consumo por área y tarea.
- `/supervisor/sitios/nuevo`: creación de un sitio desde plantilla.
- `/supervisor/comparacion`: variantes, resultados, descartes y recomendación.
- `/supervisor/reporte`: consumo, resultados y efluente con impresión a PDF.
- `/supervisor/efluente`: orientación y decisión registrada del efluente.

Los datos visibles del panel están en `src/services/supervisorMock.ts`. Están
rotulados como simulados y deben sustituirse por consultas en `services/` cuando
se conecte Supabase; las páginas no deben llamar a Supabase directamente.

Los componentes compartidos están en `src/components/ui/` y se importan desde
el índice:

```tsx
import { Button, Card, Field, PageHeader, Select } from '../../../components/ui';
```

- `PageHeader`: encabezado de pantalla con etiqueta, título, descripción y una acción.
- `Card`: contenedor semántico para métricas, tablas o formularios.
- `Button`: acción primaria o secundaria (`variant="ghost"`).
- `Field`: campo de formulario con etiqueta accesible.
- `Select`: selector etiquetado, recomendado para áreas y filtros.

Las cantidades de consumo se muestran desde datos preparados; en los formularios
operativos deben capturarse con selectores de litros/ml, nunca con texto libre,
tal como exige el ERS. La lógica de receta, desvíos, incompatibilidades y
efluente debe permanecer en `packages/core`.

La comparación usa la política del ERS: mínimo de 3 repeticiones, cumplimiento
en todas las repeticiones, menor producto promedio y desempate por agua. El
reporte se exporta mediante el diálogo de impresión del navegador; seleccionar
“Guardar como PDF”. El CSS de `@media print` oculta navegación y controles,
elimina el fondo oscuro y conserva tablas, métricas y decisiones legibles.
