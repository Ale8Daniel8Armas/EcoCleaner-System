# Simulador de medición automática

El simulador de `/operario/simulador` es una demostración local de la hoja de ruta de sensores de EcoCleaner. No usa hardware, red, MQTT, WebSockets ni `fetch`: genera lecturas en el navegador con una semilla reproducible y las guarda mediante los servicios normales de tareas y registros.

## Activación

El botón **Modo demostración** y la ruta solo se habilitan con:

```env
VITE_DEMO_TOOLS=true
```

Con la variable ausente o con cualquier valor distinto de `true`, la ruta y el botón no se registran. Para ejecutar:

```powershell
npm.cmd run dev
```

## Escenarios

- **Uso normal:** caudales con ruido pequeño; el acumulado termina dentro de ±5% de la receta.
- **Fuga de agua:** desde aproximadamente el 40% de la corrida, el caudal de agua se multiplica por cuatro. La alerta se dispara una sola vez al superar la tolerancia de agua.
- **Sobredosis de producto:** desde aproximadamente el 30%, la bomba duplica el caudal de producto. La alerta usa `calcularDesvio` y la tolerancia configurada del proyecto (10%).

Cada corrida tiene 40 lecturas, una cada 500 ms, para una demostración de unos 20 segundos. La semilla permite repetir exactamente las mismas lecturas.

## Persistencia y rotulado

Al registrar, se crea una tarea en `receta_enviada` y un registro de uso con:

- `fuente = 'simulada'`
- `marca = 'medido'`
- `alerta_sobredosis` según el desvío calculado

Los badges **Simulado** y el rótulo fijo advierten que estos datos no son mediciones reales ni evidencia de ahorro. El reporte excluye simulados por defecto y tiene el filtro **Incluir simulados**.

## Hoja de ruta para sensores reales

Un caudalímetro de pulsos podría convertir pulsos por intervalo en L/min y una bomba dosificadora podría reportar ml/min mediante una API del dispositivo. Esa integración debe vivir en un servicio/adaptador separado, validar lecturas y guardar los datos con `fuente = 'sensor'`. No debe reutilizar silenciosamente el camino simulado ni presentar datos sin marca y fuente.

## Limpieza de datos de demostración

Realiza un respaldo antes de ejecutar una limpieza. Las relaciones de tareas, registros, variantes y resultados pueden tener cascadas definidas por la base; confirma el comportamiento en el entorno antes de usar el SQL.

Ejemplo para una tarea concreta:

```sql
begin;

-- Respaldar o revisar primero las filas encontradas.
select id, tarea_id, fuente
from public.registros_uso
where fuente = 'simulada';

-- Ejecutar solo después de verificar las cascadas y el respaldo.
delete from public.tareas
where id in (
  select tarea_id
  from public.registros_uso
  where fuente = 'simulada'
);

commit;
```

En producción, sustituye el filtro por una lista explícita de IDs revisados y evita borrar datos sin respaldo.
