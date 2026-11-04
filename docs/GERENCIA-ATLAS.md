# Gerencia General: Atlas turquesa

Implementación del diseño aprobado el 4 de noviembre de 2026. Rama de trabajo: `codex/atlas-gerencia-general`. Publicación autorizada el 4 de noviembre de 2026 en el sitio existente: https://pcc-operaciones.github.io/dashboard-pcc/#gg (GitHub Pages, rama `main`).

## Pantalla

La entrada `#gg` conserva el marco y las pestañas del CMI. Presenta seis paneles, cuatro indicadores por panel, superficies blancas sobre fondo azul/turquesa y esquinas de 6 px. Operaciones muestra las unidades mensuales por etapa y los tres estados con mayor volumen del WIP; Costos, PT y Logística muestran un gráfico principal cada uno.

La vista de escritorio ocupa todo el ancho y adapta la altura de las dos filas al espacio disponible bajo la navegación. Desde 1100 px de ancho y 640 px de alto, las seis áreas quedan visibles en una pantalla, con los cuatro KPIs de cada área en una fila y miniaturas de los cinco gráficos. En alturas menores se compacta también el encabezado. Las notas secundarias pasan al detalle en pantallas bajas; la indicación de unidades PT sin costo permanece visible. Los diálogos conservan los valores, notas, leyendas y controles completos. En móvil o ventanas más estrechas los paneles se apilan con desplazamiento, para conservar legibilidad.

Los botones de indicadores y gráficos abren un diálogo ampliado. Se cierra con X o Escape. El alcance de los filtros se muestra dentro del detalle. Los gráficos incluyen leyendas interactivas y una tabla alternativa de valores; no se descargan nuevas bibliotecas.

Ventas y Talento Humano permanecen en construcción, con los indicadores previstos y sin cifras simuladas. La agenda de alertas, los compromisos, su importación/exportación y su almacenamiento anterior siguen disponibles en «Alertas y seguimiento de compromisos», debajo de los seis paneles.

## Datos compartidos

`atlas-model.js` calcula el alcance y los agregados a partir de `PccExecutiveSource()`. `atlas.js` presenta el modelo, los filtros y los detalles; `atlas.css` conserva el diseño aprobado. No hay capturas ni totales empresariales incrustados en estos archivos.

El adaptador proporciona:

- Operaciones: módulos ya cargados y fórmulas existentes de `PccData.ops`. Se conservan la eficiencia ponderada, la exclusión de Servicios y el cumplimiento basado en producción/meta.
- WIP: los lotes cargados por `loadWip`, con estados, cantidades y fechas reales de cumplimiento. Los estados se obtienen de los datos; no se limita el sistema a los trece de la captura aprobada. Se puede entrar desde cada estado a sus lotes y recorrerlos con paginación.
- Costos: `COSTOS_DATA`, con los campos ya normalizados por el área. Los promedios de rentabilidad, CCU y margen usan registros válidos para cada magnitud. El período lo determina `config.json`; no se fija octubre en el código.
- Inventario PT: `PccExecutiveInventory()` expone existencias, valoración, faltantes de costo, movimientos, ventana declarada y fechas del corte. No modifica los filtros del iframe de Inventario.
- Logística: `PccExecutiveLogistics()` expone existencias y movimientos SIESA, edad FIFO validada, metadatos y estado de carga. No altera los selectores de Logística ni inicia una segunda consulta desde Atlas.

«Actualizar» desde Gerencia General actualiza también Logística mediante su carga existente. Los cambios de carga o error notifican a Gerencia General; no se siguen presentando resultados anteriores como actualizados.

## Indicadores y detalles

| Área | Indicadores visibles | Ampliación |
|---|---|---|
| Operaciones PCC | Cumplimiento, eficiencia, unidades en proceso, unidades de Presentación en el mes configurado | Etapas mensuales, todos los estados, lotes por estado, comparación por mes y metas |
| Costos | Rentabilidad, CCU sin IVA, margen en pesos por unidad, registros negativos/total | Tendencias, listado de negativos y detalle de referencia/lote |
| Inventario PT | Unidades de todas las bodegas, costo conocido, unidades +90 y proporción del principal, despachos del mes configurado | EOP frente a RM, antigüedad del principal y cobertura de valoración |
| Logística | Valor de existencias, valor FIFO +90, valor de telas, valor de insumos | Entradas/salidas en valor, materiales, edad y existencias por empresa |
| Ventas | Venta/meta, venta al consumidor, tiendas con faltantes, reposición pendiente | Alcance previsto, sin datos simulados |
| Talento Humano | Ausentismo, personal activo, vacantes/planta, rotación | Alcance previsto, sin datos simulados |

El conteo de negativos corresponde a registros con rentabilidad menor que cero. Una referencia en dos lotes conserva sus dos registros y puede abrirse por separado. Precio, costo y margen se muestran por unidad; el margen no se presenta como utilidad de la empresa ni margen real de ventas.

## Filtros y alcance

Empresa (EU/TEX), línea (TEXSION/EU/YETRO/TWO&TWO) y categoría admiten selección múltiple. Las opciones dependientes se ajustan al cambiar empresa o línea. «Seleccionar todas» vacía la restricción de ese nivel; «Limpiar filtros» recupera el alcance general. La selección se conserva localmente con `pcc.atlas.filters.v1`, separada de los filtros de cada área.

La normalización mantiene las categorías de las fuentes: entre otras, LINEA/DOTACION de EU se presenta como EU Línea, NEW COL como EU Moda y TYT/TWO como TWO&TWO. Inventario conserva la línea ya determinada por su propio cargador y la clasificación de categorías TEX por descripción utilizada por el frente de Inventario.

No se inventan asignaciones entre fuentes:

- Eficiencia y cumplimiento globales no se desagregan por empresa/línea/categoría cuando el origen no respalda esa asignación.
- WIP de TEX no se divide artificialmente entre EVA/LAXO/DISNEY/DOTACIÓN si el campo de categoría no está disponible.
- Logística permite empresa; un filtro de línea o categoría de producto terminado presenta ausencia de desglose en sus cifras.
- Un indicador no disponible se muestra con guion y explicación, sin reutilizar el total global como si estuviera filtrado.

Las existencias totales de PT incluyen todas las bodegas. Los tramos de antigüedad y su porcentaje conservan el universo principal, excluyendo Segundas y Cobros. La valoración se identifica como parcial cuando hay unidades sin costo. La edad FIFO distingue el saldo mayor a 90 días y la edad indeterminada.

Los gráficos de flujos usan la ventana declarada de cada fuente. Los meses de frontera incompletos llevan asterisco. Los movimientos mensuales de PT no se presentan como transacciones diarias. Los meses posteriores al período operativo configurado no se convierten en ceros futuros.

## Validación

Dieciséis pruebas del modelo cubren fórmulas, denominadores, período, filtros dependientes, identidad de lotes incluso si cambia el orden de la fuente, valoración parcial, universos, ventanas y fallos. La suite completa del repositorio pasó: 190 pruebas, incluidas las anteriores.

La revisión de navegador utiliza las páginas de trabajo y las bibliotecas externas originales con capturas reales locales del 4 de noviembre. Las respuestas de negocio y las dependencias almacenadas para esta revisión permanecen fuera del repositorio. No representan una consulta nueva al servicio de Google Sheets; la implementación conserva las conexiones existentes para su uso normal.

Se contrastaron los totales con la propuesta aprobada, las 47 aperturas principales, referencia/lote y retorno, filtros EU/TEX/YETRO/LAXO, lotes de No conforme, las cinco pestañas, tamaños 1440/1024/736/375/320, ausencia de desbordamiento horizontal y recuperación de Costos tras un fallo simulado. No se detectaron errores de ejecución. Se usó Playwright instalado porque el plugin Browser no estaba disponible; las fuentes tipográficas remotas usaron su respaldo declarado durante esta revisión sin red.

El ajuste de altura se comprobó en 1860×942, 1920×1080, 1440×900, 1366×768, 1280×720, 1100×700, 1100×680, 1366×650 y 1100×640: las seis áreas quedan dentro del viewport y los gráficos no se solapan. Se repitieron las 47 aperturas a 1366×768 y la vista móvil a 375×850.

El servidor local de comparación admite los archivos nuevos de Atlas y las dependencias de las cuatro áreas. La URL pública no cambia en esta entrega y no se publica mediante Sites.
