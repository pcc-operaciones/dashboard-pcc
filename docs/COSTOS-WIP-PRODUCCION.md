# Costos asumidos en WIP — mismo circuito de Producción

`SyncExcel` ya ejecuta `sincronizarDatos()` a las 6:00 y `calcularKPIs()` a las 7:00. La integración usa **el mismo proyecto, los mismos activadores y el mismo libro KPI PCC MENSUAL**. No requiere un segundo Apps Script ni un servicio intermedio. Los dos Excel de costos conservan sus ID en Drive.

## Instalación en el proyecto existente

1. En `SyncExcel`, añadir un archivo de secuencia llamado `CostosWip` y pegar [CostosWip.gs](../apps-script/production-wip/CostosWip.gs). Si ya se pegó una versión anterior, sustituir su contenido completo. Conservar las funciones existentes `leerExcel` y `escribirHoja`.
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

La fecha de `B2` representa el corte común del ERP, no el instante de actualización del navegador. Debe corresponder al día en que se reemplazaron los cuatro Excel o al día anterior. El script espera si falta uno de los cuatro, si los Excel de lotes aún no se copiaron a las hojas crudas, o si un archivo cambió durante el procesamiento. Las horas de modificación verifican que el paquete es nuevo y estable; el operador confirma que su contenido corresponde a la fecha declarada. Si no cambian los archivos, no vuelve a convertirlos. Rechaza encabezados faltantes, OP duplicadas, valores inválidos o negativos y diferencias mayores a cinco centavos entre MP + MO + CIF y el total. Ante un error conserva el último corte publicado.

La hoja `WIP_COSTOS` tiene una fila por **empresa + OP** y guarda fecha de corte, estado informado por el Excel, MP, MO, CIF, costo total y fecha de actualización del archivo. El dashboard cruza esa clave con los lotes activos, muestra el costo solo de las OP encontradas y señala cuántas OP activas no tienen costo. Los filtros de empresa y cliente se aplican sobre las OP visibles. Una misma OP se cuenta una sola vez, aunque tenga varias filas de lotes.

## Botones dentro de Google Sheets

El proyecto `SyncExcel` está vinculado a `KPI PCC MENSUAL`. Añadir [PanelCargaWip.gs](../apps-script/production-wip/PanelCargaWip.gs) como **un archivo de código nuevo** en ese mismo proyecto y recargar la hoja. Aparece el menú **Carga WIP → Abrir panel de carga**. El panel contiene el campo de fecha y los botones **Procesar los cuatro Excel** y **Consultar estado**.

El botón de proceso guarda la fecha común en `CONTROL_WIP!B2`, ejecuta `sincronizarDatos()` y, cuando termina, ejecuta `calcularKPIs()`. Son dos llamadas separadas para respetar el diseño original contra tiempos de espera largos. Al final consulta `CONTROL_WIP!B3` y el número de OP publicadas. Si una llamada falla, el panel muestra el error y no informa que la publicación se completó. El menú `onOpen` es un activador simple de interfaz; no se instala otro activador periódico. Los dos activadores diarios existentes siguen funcionando.

## Alcance y límite

Este cambio publica el **último corte de costos WIP**. No crea todavía cierres mensuales de WIP. `SyncExcel` continúa copiando los lotes y generando `KPI_ALERTAS` como antes. El script que compartió el usuario es la fuente de referencia para el punto de inserción; no hay acceso de edición desde esta sesión al proyecto privado, por lo que el pegado y la primera ejecución deben hacerse en su cuenta.
