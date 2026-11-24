# Costos asumidos en WIP — mismo circuito de Producción

`SyncExcel` ya ejecuta `sincronizarDatos()` a las 6:00 y `calcularKPIs()` a las 7:00. La integración usa **el mismo proyecto, los mismos activadores y el mismo libro KPI PCC MENSUAL**. No requiere un segundo Apps Script ni un servicio intermedio. Los dos Excel de costos conservan sus ID en Drive.

## Instalación en el proyecto existente

Antes de ejecutar WIP, en el editor de `SyncExcel` pulsar **Servicios → + → Google Sheets API → Añadir**. El módulo escribe `CONTROL_WIP` y publica `WIP_COSTOS` mediante la API de Sheets para evitar tiempos de espera del servicio de hojas en este libro. En un proyecto predeterminado de Apps Script, añadir el servicio habilita la API en su proyecto de Cloud. Si `SyncExcel` usa un proyecto de Cloud estándar, habilitar también **Google Sheets API** en ese mismo proyecto. Conservar el servicio Drive existente.

1. En `SyncExcel`, pegar [CostosWip.gs](../apps-script/production-wip/CostosWip.gs) como archivo separado si el proyecto aún no incluye el módulo. En producción el módulo está al final de `Código.gs`, después del marcador `COSTOS WIP`, y se actualiza sustituyendo ese bloque. Conservar las funciones existentes `leerExcel` y `escribirHoja`.
2. En la función **existente** `sincronizarDatos()`, justo después de `const ss = SpreadsheetApp.openById(KPI_SPREADSHEET_ID);`, añadir:

   ```js
   const pccWipLotesAntes = pccWipVersionesLotes_();
   ```

   Al final de esa función, después de copiar `CALIDAD_BD` y antes del registro `PASO 1 completado`, añadir:

   ```js
   pccWipRegistrarLotesCopiados_(pccWipLotesAntes);
   ```

3. En la función **existente** `calcularKPIs()`, justo después de `calcularKPI_ALERTAS(ss, lotes, hoy);`, añadir esta línea:

   ```js
   sincronizarCostosWip_(ss);
   ```

4. En el libro `KPI PCC MENSUAL`, crear la pestaña `CONTROL_WIP` y escribir en `B2` la fecha de corte común de los **cuatro** informes como texto `AAAA-MM-DD` (por ejemplo `2026-11-14`). El script crea las etiquetas y escribe el estado en `B3`.
5. Reemplazar los cuatro Excel de WIP en Drive conservando sus ID. Para la primera validación, ejecutar primero `sincronizarDatos()` y luego `calcularKPIs()`. Después se usan sus activadores existentes de las 6:00 y las 7:00. Si el cargue ocurre más tarde, ejecutar ambas funciones en ese orden; no hace falta otro activador.
6. Verificar en `CONTROL_WIP!B3` que diga `PUBLICADO` y comprobar la pestaña `WIP_COSTOS`. Luego revisar el tablero WIP. Publicar el cambio del dashboard solo después de que exista la pestaña de datos.

La fecha de `B2` representa el corte común del ERP. El panel identifica los Excel cuya fecha de modificación en Drive es anterior al corte y detiene la carga antes de copiar. Si alguno se cargó más de un día después del corte, el operador debe verificar el contenido de los cuatro Excel y confirmar el atraso en el panel. La confirmación en `B4` queda ligada al corte y a las cuatro versiones, por lo que se invalida al reemplazar cualquiera. El script también verifica que los cuatro archivos sean nuevos, que los lotes se hayan copiado y que el paquete se mantenga estable durante el procesamiento. Rechaza encabezados faltantes, OP duplicadas, valores inválidos o negativos y diferencias mayores a cinco centavos entre MP + MO + CIF y el total. Ante un error conserva el último corte publicado.

La hoja `WIP_COSTOS` tiene una fila por **empresa + OP** y guarda fecha de corte, estado informado por el Excel, MP, MO, CIF, costo total y fecha de actualización del archivo. El dashboard cruza esa clave con los lotes activos, muestra el costo solo de las OP encontradas y señala cuántas OP activas no tienen costo. Los filtros de empresa y cliente se aplican sobre las OP visibles. Una misma OP se cuenta una sola vez, aunque tenga varias filas de lotes.

## Botones dentro de Google Sheets

El proyecto `SyncExcel` está vinculado a `KPI PCC MENSUAL`. Añadir o actualizar [PanelCargaWip.gs](../apps-script/production-wip/PanelCargaWip.gs) en el mismo proyecto y recargar la hoja. El menú **Carga WIP → Abrir panel de carga** permite procesar el paquete, consultar las fechas de modificación de los cuatro archivos y registrar el cierre mensual de Operaciones.

El botón de proceso guarda la fecha común en `CONTROL_WIP!B2`, ejecuta `sincronizarDatos()` y, cuando termina, ejecuta `calcularKPIs()`. Son dos llamadas separadas para respetar el diseño original contra tiempos de espera largos. Al final consulta `CONTROL_WIP!B3` y el número de OP publicadas. Si una llamada falla, el panel muestra el error y no informa que la publicación se completó. El menú `onOpen` es un activador simple de interfaz; no se instala otro activador periódico. Los dos activadores diarios existentes siguen funcionando.

Si aparece `Sheets API HTTP 403` indicando que la API no está habilitada, añadir el servicio Google Sheets API según el primer párrafo y ejecutar solo `calcularKPIs()` si `sincronizarDatos()` ya terminó correctamente. No se requiere volver a reemplazar los Excel.

## Cierres mensuales

Con la versión actualizada de `CostosWip.gs` instalada en `SyncExcel`, cuando el paquete de cuatro Excel corresponde al último día calendario del mes, la misma publicación registra un cierre en `OPS_WIP_CIERRES` a partir del **30 de noviembre de 2026**. El primer cierre crea la hoja. Las nuevas ejecuciones del mismo corte conservan el registro existente. Los cortes intermedios siguen actualizando `WIP_COSTOS`.

El cierre suma las unidades de los lotes activos de EU y TEX y el costo conocido de sus OP. Cada OP con costo suma una sola vez por empresa. La cobertura identifica las OP activas y cuántas tienen costo. Los lotes entregados y cancelados quedan fuera.

Históricos vincula el saldo archivado con el cierre de Operaciones de la misma fecha. El valor queda vacío si hay lotes activos sin ninguna OP con costo. [Registro del cierre de Operaciones](OPERACIONES.md#registrar-el-cierre-mensual)
