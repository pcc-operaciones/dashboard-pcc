# Operaciones PCC

Base de trabajo revisada el 23 de noviembre de 2026. La copia local está en `codex/atlas-gerencia-general`, commit `fb851e4`, y `config.json` indica noviembre de 2026. El commit coincide con la referencia local `origin/main` al momento de la revisión.

## Vistas y fuentes

| Vista | Fuente y punto de entrada |
|---|---|
| Área General, Por Módulo y Seguimiento Diario | Hojas de producción del período en `config.json`. `loadAll()` y `loadMod()` cargan los módulos. `PccData.tasks()` excluye fuentes sin configuración validada y hojas repetidas. |
| Alertas OP | `KPI_ALERTAS` en `KPI PCC MENSUAL`, consultada por `loadAlertas()`. |
| WIP | `EU_Lotes`, `TEX_Lotes` y `WIP_COSTOS` en `KPI PCC MENSUAL`, consultadas por `loadWip()`. El costo se cruza por empresa y orden de producción (OP). La cobertura y el corte se muestran en WIP. |
| Presupuesto | `PPTO mes` en `KPI PCC MENSUAL`, consultada por `loadPpto()`. |
| Históricos | Cierres nuevos de `OPS_CIERRES` y saldos del mismo corte en `OPS_WIP_CIERRES`. |

La navegación y las funciones de carga están en [index.html](../index.html). Las reglas de agregación y selección están en [data-quality.js](../data-quality.js), y los costos por estado y cliente en [wip-cost-groups.js](../wip-cost-groups.js).

## Reglas de los indicadores

- Eficiencia = minutos reales ÷ minutos teóricos, con los días activos y la exclusión de Servicios. Cumplimiento = unidades producidas ÷ meta en unidades. Rentabilidad = (ingresos − costos) ÷ ingresos. Cada indicador global suma sus bases válidas. [Indicadores](INDICADORES.md)
- En los módulos, la vigencia se mide con la última actividad registrada. El umbral configurado para Operaciones es de dos días calendario. En WIP, revisar la fecha del informe de lotes y el corte del costo como referencias distintas. [Vigencia de los datos](VIGENCIA-DATOS.md)
- `SyncExcel` publica el último corte de costos WIP a partir de cuatro Excel. `CONTROL_WIP!B2` contiene el corte común y `CONTROL_WIP!B3` muestra el estado de publicación. La vista suma costos conocidos y muestra la cobertura de OP. [Costos WIP en Producción](COSTOS-WIP-PRODUCCION.md)

## Revisión local

Ejecutar desde la carpeta `dashboard-pcc`, que contiene el repositorio Git del tablero.

```powershell
node scripts/serve-local.cjs
```

Abrir [Operaciones en la vista local](http://127.0.0.1:4174/#ops). Para comparar con las capturas del servidor de revisión, ejecutar `node scripts/review-server.cjs` y abrir [Operaciones en la versión de revisión](http://127.0.0.1:4173/after/#ops). La primera captura de una fuente requiere acceso a Google Sheets. [Configuración de la revisión](../README.md#comparación-local)

```powershell
node --test tests/*.test.cjs
git diff --check
```

## Históricos desde noviembre de 2026

El primer corte es el **30 de noviembre de 2026**. La pestaña muestra una fila por cierre registrado. Eficiencia, rentabilidad y cumplimiento se calculan desde los módulos diarios del período, con las fórmulas del tablero. No conforme usa las OP con fin de Presentación en ese mes. La cobertura de módulos queda guardada con los indicadores. WIP incorpora solamente las unidades y costos archivados para esa misma fecha.

### Registrar el cierre mensual

1. Instalar las versiones actualizadas de [CostosWip.gs](../apps-script/production-wip/CostosWip.gs) y [PanelCargaWip.gs](../apps-script/production-wip/PanelCargaWip.gs) en `SyncExcel`. Publicar la versión del tablero que incluye Históricos.
2. Con las hojas de módulos y calidad definitivas, mantener el mes que se va a cerrar en `config.json`. Para noviembre, preparar el cierre a partir del 1 de diciembre en hora Colombia, antes de cambiar la configuración a diciembre.
3. En **Operaciones → Históricos → Preparar cierre del mes**, revisar la cobertura y copiar el cierre generado. En `KPI PCC MENSUAL`, abrir **Carga WIP → Abrir panel de carga → Registrar cierre de Operaciones**, pegar el cierre y registrarlo. El proceso crea `OPS_CIERRES` al guardar la primera fila y conserva los cortes ya registrados.
4. Procesar los cuatro Excel WIP del mismo fin de mes en el panel de carga. Al actualizar el tablero, verificar que Históricos muestre la fila y su cobertura WIP. Si el paquete aún está pendiente, la fila muestra los indicadores de Operaciones y deja WIP sin corte. [Cierres WIP](COSTOS-WIP-PRODUCCION.md#cierres-mensuales)

## Pendientes documentados

- Confirmar el archivo y los nombres de hojas de EU Moda, validar las fuentes de Presentación EU (`PREU2` y `PRES|PRES_EU`) y conciliar la asignación de `EF M4` y `EF PRESC`. [Control del cambio de la versión 2](VERSION-2.md#pendientes-de-conciliación-y-siguientes-entregas)
- Para validar WIP con el último corte, comprobar `CONTROL_WIP!B3`, `WIP_COSTOS` y la cantidad de OP activas con costo bajo los filtros de empresa y cliente. [Procedimiento de carga y validación](COSTOS-WIP-PRODUCCION.md)
