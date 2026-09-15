# Gerencia General

Implementación del 14 de septiembre de 2026. Rama: codex/gerencia-general. Base: v2.0.0.

## Alcance

La entrada principal es Gerencia General. Comparte fuentes y fórmulas con las áreas, sin realizar nuevas consultas a Google Sheets. Las vistas se pueden abrir con #gg, #ops, #cos y #inv. Los accesos desde las tarjetas aplican el alcance del resumen; el selector superior permite volver a la vista de cada área.

Mapa central en executive-model.js:

| ID | Área | Estado |
|---|---|---|
| ops | Operaciones | Integrada |
| cos | Costos | Integrada |
| inv | Inventario PT | Integrada |
| log | Logística: telas e insumos | Prevista |
| sales | Ventas | Prevista |

Las áreas futuras no aportan métricas ni se presentan como disponibles. Sus responsabilidades y alcance están definidos para conectarlas después.

## Indicadores

- Eficiencia de producción: misma fórmula ponderada de Operaciones, excluye Servicios; meta existente de 75%.
- Cumplimiento: producción / meta de módulos con denominador disponible; meta existente de 100%. La barra admite resultados mayores a 100%.
- Rentabilidad de costeos: promedio por registro del mes configurado; conserva el cálculo actual de Costos. No se presenta como margen de ventas ni utilidad de la empresa.
- Costeos negativos: número de registros con rentabilidad menor que cero, sin duplicarlos como referencias únicas.
- Existencias PT: unidades de registros normales; excluye Segundas y Cobros.
- Existencias mayores a 90 días: suma de u3 en el mismo universo de existencias; porcentaje sobre unidades, distinto del porcentaje de obsolescencia monetaria del frente Inventario.

Operaciones y Costos usan mes/año de config.json. Inventario utiliza su último conjunto de datos disponible y muestra el estado y fechas del origen. No se fuerza un corte común no respaldado por las fuentes. El resumen no depende de filtros particulares que otro recorrido haya dejado activos.

Sin configuración, no se calculan indicadores mensuales. Sin datos, un porcentaje inexistente o una carga fallida se muestra como ausencia, no como cero. Mientras un frente carga, sus métricas se ocultan. Los resultados parciales conservan el aviso de fuentes incompletas.

## Asuntos y compromisos

La agenda muestra primero los problemas de disponibilidad/vigencia y luego las desviaciones detectadas: producción bajo meta, eficiencia baja, costeos negativos e inventario envejecido. Las acciones son propuestas para revisar; no afirman causas, montos de impacto o decisiones ya acordadas.

Se pueden crear, editar, completar y reabrir compromisos con área, responsable, fecha y decisión/avance. El formulario valida campos obligatorios y fechas. Las entradas importadas se validan y se muestran con textContent. No se insertan como HTML.

El almacenamiento es local al origen y navegador: pcc.executive.commitments.v1. No constituye colaboración multiusuario, asignación con notificaciones ni permisos de acceso. Exportación e importación JSON permiten conservar y trasladar copias; importar conserva los compromisos ya existentes con el mismo ID. Los errores de almacenamiento se informan y no se anuncian como guardado exitoso.

## Integración futura

Para incorporar un área: activar su registro, conectar su fuente y estado de carga, definir métricas con fórmula/alcance/fecha y añadir navegación y pruebas. La Gerencia General recibe agregados del mismo origen; no debe reproducir hojas ni mantener cifras manuales paralelas.

Para compartir compromisos y administrar por roles se requiere una capa de autenticación y almacenamiento en servidor, permisos verificados en servidor y registro de cambios. No basta con ocultar pestañas. No se modificaron accesos o permisos de Google Sheets.

Ventas permitirá incorporar ventas frente a meta y cartera de pedidos; Logística, disponibilidad de telas/insumos y bloqueos. Entregas completas y a tiempo requieren datos de pedidos, fechas comprometidas y entregas reales. Margen real y capital inmovilizado requieren conciliación contable de costos y valores; no se infieren de las cifras actuales.

## Diseño y validación

Se aplicaron frontend-design y ui-ux-pro-max. La búsqueda de sistema visual devolvió un estilo más llamativo que el solicitado; se conservó la identidad PCC y la preferencia explícita por avisos sutiles. Paleta: azul #1B3A5C, verde petróleo #0D6B5E, fondo #F5F7FA, borde #D6E0EA, texto secundario #536478 y ámbar #8B5600. Tipografía DM Sans, jerarquía por tamaño/peso y cifras tabulares. Elemento principal: lectura ejecutiva con metas legibles y acceso a la evidencia de cada área.

- 37 pruebas automatizadas: las 27 existentes y 10 del nuevo modelo, fechas y compromisos.
- Sintaxis de los scripts de ambas páginas y de los nuevos archivos.
- Comparación local con capturas, marcada explícitamente; no representa datos en vivo.
- Navegación de las tres áreas; Costos mantiene septiembre y coincide con el promedio del resumen.
- Detalle de fuentes accesible y desplegable.
- Compromiso de prueba creado en localhost, recuperado después de recargar y completado. La prueba queda separada del origen 127.0.0.1 y de producción.
- Vista ejecutiva móvil con ancho de contenido igual al viewport, sin desplazamiento horizontal. Las limitaciones móviles de los frentes anteriores siguen siendo un pendiente separado.
- Revisión visual de escritorio.

## Revisión

Abrir http://127.0.0.1:4173/after/#gg con el servidor local de revisión activo. Publicación aprobada como versión principal v2.1.0 el 15 de septiembre de 2026. El respaldo v2.0.0 conserva la entrega anterior. Ver VERSION-2.1.md para el alcance y la reversión.

## Alertas gestionables — 15 de septiembre de 2026

La agenda incluye únicamente fallos de consulta, atrasos confirmados por la referencia de cada fuente y desviaciones medidas (producción/eficiencia bajo meta, costeos negativos, inventario de más de 90 días). Cada alerta de fuentes enumera exclusivamente las afectadas, en detalle desplegable. Un área puede tener fuentes al día y otras atrasadas: las primeras nunca se añaden a esa alerta.

Se excluyen estados de carga, fuentes al día, fechas no informadas, ausencia de actividad y períodos sin costeos sin un fallo confirmado. Esos estados siguen siendo consultables dentro del cuadro de mando de cada área, pero no generan por sí mismos una tarea correctiva. Las alertas desaparecen al resolverse su condición. Los compromisos creados por el usuario conservan su seguimiento independiente. No se alteran los indicadores ni el umbral configurado.


Las tarjetas de Estado de las áreas también filtran su desplegable: «Fuentes que requieren atención» muestra solo fallos y atrasos confirmados. Los módulos al día y los avisos informativos se omiten; sin incidencias no se muestra ese desplegable. El detalle completo de fuentes permanece en el cuadro de mando de cada área.
