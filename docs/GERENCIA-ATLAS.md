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


## Carga de Inventario PT y coherencia de color — 4 de noviembre de 2026

Se reprodujo en producción un rechazo HTTP 429 de INV_Bodegas. La carga anterior consultaba las tres tablas actuales en serie, descargaba de nuevo EU_Lotes/TEX_Lotes y construía las nueve vistas del iframe oculto, incluidas consultas históricas ajenas al resumen ejecutivo.

`inventory-loader.js` reúne INV_Resumen, INV_Bodegas e INV_Movimientos en `values:batchGet`, con valores sin formato, registro de vigencia por tabla y comprobación del mismo corte. Los reintentos de 429/503 son limitados y respetan Retry-After. Los tiempos de espera cancelan la petición, en lugar de dejarla activa tras una Promise.race. No se incorpora una caché de cifras de inventario.

La carga inicial reutiliza la promesa de trazabilidad de Operaciones. Una actualización exclusiva de Inventario vuelve a consultar sus fuentes; una actualización conjunta comparte la nueva lectura de WIP. La publicación de datos hacia Gerencia precede a la construcción de vistas. OP No Recibidas y las consultas históricas de Inventario se preparan al abrir su pestaña; las aperturas posteriores reutilizan esa preparación hasta Actualizar. Los errores de fuente siguen ocultando los indicadores afectados.

El fondo de Gerencia utiliza `--navy` (#1B3A5C), la misma variable institucional de los subtítulos del cuadro de mando, conservando los acentos turquesa.

Validación: 197 pruebas automatizadas aprobadas; 47 ampliaciones, filtros dependientes, navegación por áreas, vistas propias de Inventario, recuperación tras 400 y dos rechazos 429 simulados, y tamaños 1440/1024/736/375/320 sin desbordamiento. Las capturas reales locales conservaron 154.909 unidades, $4.493.849.774,80 de costo conocido, 2 unidades sin costo y 74.162 unidades mayores de 90 días. Durante Gerencia ya no se consultan INV_Hist_* ni OP_NO_RECIBIDA_BPT. Una comprobación del candidato con datos reales obtuvo respuesta 200 del lote de inventario en 1,39 s y publicó Inventario antes que Costos; es una observación de laboratorio sin emulación, no un SLA ni un percentil de usuarios. Los scripts, capturas y respuestas de QA permanecen fuera del repositorio.


## Modales compactos de Operaciones — 4 de noviembre de 2026

Producto en proceso conserva los estados, cantidades, lotes, orden por flujo/volumen y acceso al detalle. Las filas compactas permiten ver los trece estados actuales completos. Unidades mensuales por etapa muestra la tabla directamente debajo de la curva, con cinco filas, meses en columnas y total por etapa; no suma etapas entre sí. Se retiró la vista redundante «Etapas en un mes»; Presentación abre ahora el gráfico mensual con su tabla.

Eficiencia y Cumplimiento se presentan juntos, con tendencia diaria, meta de 75%/100% y desglose por proceso. El modelo reutiliza PccData.ops para todos los cocientes: conserva ponderaciones y denominadores, excluye Servicios de eficiencia, admite resultados superiores al 100% y representa ausencia de denominador con un guion. Los filtros sin desglose respaldado continúan ocultando esos indicadores. Los gráficos de ambos paneles se destruyen al cerrar, cambiar de vista o actualizar.

Los modales de etapas y desempeño omiten la franja repetida de KPIs para dedicar el espacio al contenido solicitado. Se mantiene el alcance de los filtros y las notas de lectura. En móvil, las secciones de desempeño se apilan y la tabla permite desplazamiento horizontal.

Validación: 200 pruebas automatizadas aprobadas, 46 ampliaciones del tablero, navegación y recuperación de fuentes; 21 verificaciones de ajuste modal (tres vistas en siete tamaños: 1860×942, 1440×900, 1366×768, 1280×720, 1100×640, 1024×768 y 900×600) sin desplazamiento vertical del modal. Se comprobaron cifras mensuales de las capturas reales, lotes de No conforme, series activables, filtros, actualización con el modal abierto, dos curvas simultáneas, ausencia de gráficos huérfanos y vista móvil. Las capturas y scripts de QA permanecen fuera del repositorio; se utilizó Playwright porque Browser no está disponible.


## Costos: alcance, integridad y referencias — 5 de noviembre de 2026

Se reprodujo la diferencia de las capturas: en el rango antiguo de 9.999 registros, Empresa EU de Gerencia promediaba 18 registros de octubre (0,3565%), mientras la línea EU de Costos incluía 15 (9,8750%). Gerencia estaba limitada al mes operativo configurado. Además, el rango A1:DZ10000 dejaba fuera 139 filas con datos: la hoja completa tenía 10.138 registros válidos. La lectura ahora usa A:DZ y UNFORMATTED_VALUE, sin introducir fuentes nuevas ni cifras almacenadas en producción.

`cost-model.js` centraliza promedios por registro, cantidades, utilidad, clasificación y agrupación por referencia/unidad de negocio. Costos y Gerencia comparten estos cálculos. La lectura de números conserva decimales nativos y exportados, incluidos tres decimales: 12951,699 se interpreta como 12951.699, no como 12951699. Los porcentajes numéricos se conservan como fracciones y la utilidad por unidad ya no se trunca con parseFloat. Se homologó TYT con TWO&TWO. No se mezclan referencias homónimas de empresas o unidades de negocio diferentes.

Costos de Gerencia inicia en el año calendario actual y todos sus meses disponibles. Su selector permite varios años/meses, todos los períodos y restablecer el año en curso. Opera independientemente del mes de Operaciones. Empresa EU sigue incluyendo las líneas EU, YETRO y TWO&TWO; el modal declara las líneas realmente incluidas. «Ver mismo alcance en Costos» transfiere años, meses, líneas y categorías a la pestaña original para comparar exactamente las mismas filas.

Se agregaron accesos visibles en la tarjeta de Costos a los 10 grupos con mayor y menor rentabilidad y a las 5 mayores variaciones del costo total. Los grupos se ordenan por rentabilidad media de sus registros; el importe es la suma de la utilidad de costeo por lote (UTILIDAD EU × cantidad). Los datos ausentes no se convierten en cero; las sumas parciales se identifican. Las dos listas son independientes y pueden coincidir si hay menos de 20 referencias. Cada referencia abre sus registros de soporte.

La variación utiliza el costo total unitario, no la suma de los componentes ni el costo multiplicado por volumen. Conserva la lógica de lotes válidos y ventanas de Alertas: mes de referencia y anterior contra los seis meses previos; promedio aritmético por lote, cantidad positiva, costo positivo y exclusión de ajustes sin tela. Solo referencias con datos en ambas ventanas; orden por magnitud y signo visible. Se aplican empresa/línea/categoría y referencias del período elegido; el histórico conserva el contexto fuera de ese año. En el año actual sin meses explícitos, la ventana termina en el mes calendario actual; con meses elegidos termina en el último mes seleccionado. Un año anterior usa su último mes disponible.

Se retiró «Lotes en proceso» del selector y el enlace a la lista general. El clic en cada estado conserva el detalle de sus lotes y un retorno a los estados.

Validación: 210 pruebas automatizadas; comparación de Gerencia/Costos con empresa EU, línea EU anual, línea EU en octubre y TEX/LAXO en 2025; sumas de utilidad, registros de soporte, ventanas de variación, filtros de fecha, vista móvil y cuatro tamaños de escritorio hasta 1100×640. Se comprobó que las seis áreas siguen visibles y los modales de Costos caben sin desplazamiento vertical en esos tamaños. La prueba del candidato contra Google Sheets sin respuestas sustituidas leyó 10.138 filas y verificó igualdad numérica exacta de los seis indicadores de línea EU anual. Rentabilidad observada: 10,6105988032%; incluye información que antes quedaba fuera del rango. Los artefactos y datos de QA permanecen fuera del repositorio.
