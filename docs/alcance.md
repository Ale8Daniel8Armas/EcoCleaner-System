# EcoCleaner: alcance del prototipo

## Objetivo
Ayudar a preparar, medir y mejorar tareas de limpieza industrial en uso de agua,
producto químico y gestión del efluente, con registro manual desde el celular.

## Alcance inicial
Lavado de pisos y superficies industriales no críticas. No incluye superficies
donde la eficacia sanitaria sea crítica (por ejemplo, hospitales).

## P0 (obligatorio, debe funcionar de punta a punta)
- [ ] Catálogo de 6 productos con dilución, pH de la ficha e incompatibilidades
- [ ] Receta: litros de agua y ml de producto según m², superficie y suciedad
- [ ] Registro de agua y producto usados, tiempo, y marca "medido" o "estimado"
- [ ] Criterio de limpieza (cumple / no cumple) definido por el supervisor
- [ ] Comparación de variantes: solo cuentan las que cumplen; se recomienda la de menor consumo
- [ ] Alertas de sobredosis y de mezclas incompatibles
- [ ] Guía de efluente: verter / ajustar / reutilizar / gestor autorizado
- [ ] Panel del supervisor y reporte imprimible
- [ ] Esquema de datos multisitio (sitios y áreas)

## P1 (solo si el P0 está estable)
Orden: 3) simulador de fuga, 1) QR por área, 2) explicador con LLM.

## Hoja de ruta (no se construye ahora)
Sensores de caudal y pH, foto con IA, modo sin conexión, WhatsApp.

## Reglas
- Los cálculos y las alertas de seguridad los hace el código, nunca el LLM.
- El LLM no está en el camino crítico: si falla, se muestra un texto plantilla.
- No se prometen porcentajes de ahorro; se muestra lo medido en pruebas.
- Los datos simulados se rotulan como simulados.
- El software orienta y documenta el efluente; no lo neutraliza físicamente.
- Ninguna variante puede salirse del rango de dilución de la ficha del fabricante.

## Fechas
- Sáb 10 a jue 15: desarrollo previo (P0 congelado el jueves 15)
- Vie 16: desarrollo en el evento
- Sáb 17: pruebas, errores y ensayos