# Costos asumidos en WIP — mismo circuito de Producción

`SyncExcel` ya ejecuta `sincronizarDatos()` a las 6:00 y `calcularKPIs()` a las 7:00. La integración usa **el mismo proyecto, los mismos activadores y el mismo libro KPI PCC MENSUAL**. No requiere un segundo Apps Script ni un servicio intermedio. Los dos Excel de costos conservan sus ID en Drive.

## Instalación en el proyecto existente

1. En `SyncExcel`, añadir un archivo de secuencia llamado `CostosWip` y pegar [CostosWip.gs](../apps-script/production-wip/CostosWip.gs). Conservar las funciones existentes `leerExcel` y `escribirHoja`.
2. En la función **existente** `calcularKPIs()`, justo después de `calcularKPI_ALERTAS(ss, lotes, hoy);`, añadir esta línea:

   ```js
   sincronizarCostosWip_(ss);
   ```

3. En el libro `KPI PCC MENSUAL`, crear la pestaña `CONTROL_WIP` y escribir en `B2` la fecha de corte de los **dos** informes como texto `AAAA-MM-DD` (por ejemplo `2026-11-13`). El script crea las etiquetas y escribe el estado en `B3`.
4. Reemplazar los dos Excel de costos en Drive conservando sus ID y ejecutar `calcularKPIs()` una vez para la primera validación. Después se usa el activador existente de las 7:00. Si el cargue ocurre más tarde, se puede ejecutar esa misma función manualmente; no hace falta otro activador.
5. Verificar en `CONTROL_WIP!B3` que diga `PUBLICADO` y comprobar la pestaña `WIP_COSTOS`. Luego revisar el tablero WIP. Publicar el cambio del dashboard solo después de que exista la pestaña de datos.

La fecha de `B2` representa el corte del ERP, no el instante de actualización del navegador. Debe corresponder al día en que se reemplazaron ambos Excel o al día anterior. El script no publica una pareja incompleta: si solo cambia EU o TEX, espera al otro. Si no cambian los archivos, no vuelve a convertirlos. Rechaza encabezados faltantes, OP duplicadas, valores inválidos o negativos y diferencias mayores a cinco centavos entre MP + MO + CIF y el total. Ante un error conserva el último corte publicado.

La hoja `WIP_COSTOS` tiene una fila por **empresa + OP** y guarda fecha de corte, estado informado por el Excel, MP, MO, CIF, costo total y fecha de actualización del archivo. El dashboard cruza esa clave con los lotes activos, muestra el costo solo de las OP encontradas y señala cuántas OP activas no tienen costo. Los filtros de empresa y cliente se aplican sobre las OP visibles. Una misma OP se cuenta una sola vez, aunque tenga varias filas de lotes.

## Alcance y límite

Este cambio publica el **último corte de costos WIP**. No crea todavía cierres mensuales de WIP. `SyncExcel` continúa copiando los lotes y generando `KPI_ALERTAS` como antes. El script que compartió el usuario es la fuente de referencia para el punto de inserción; no hay acceso de edición desde esta sesión al proyecto privado, por lo que el pegado y la primera ejecución deben hacerse en su cuenta.
