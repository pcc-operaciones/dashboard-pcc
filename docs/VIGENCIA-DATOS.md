# Vigencia de los datos

La franja compacta aparece en Operaciones, Costos e Inventario y permanece al cambiar sus pestañas internas. La fecha del origen y el estado quedan visibles; período, fuentes y observaciones se despliegan con Ver detalle. La fecha del origen nunca se reemplaza por la del botón Actualizar.

## Significado

- **Fuentes actualizadas:** fechas declaradas por cada fuente. Si hay fechas distintas, se muestra el intervalo y el número de fuentes sin fecha completa.
- **Datos correspondientes a:** período de la información, independiente de la actualización del origen.
- **Ver fuentes y fechas:** detalle de cada hoja, estado, corte o último registro y hora de consulta separada.
- En Operaciones, el último día con registro se vincula al mes/año configurado y se identifica como tal; no certifica una actualización ni un corte completo.
- En Costos, período y último costeo responden a los filtros principales. El detalle de la fuente describe su conjunto completo.
- En Inventario, existencias y movimientos tienen referencias separadas. Si no se publica el corte de existencias, se muestra “corte no informado”.
- Las horas sin zona en la fuente se conservan y se identifican como “hora de origen; zona no informada”. Los timestamps con zona explícita se muestran en hora Colombia.
- En la comparación local las respuestas están congeladas. Su fecha de origen tampoco se actualiza al consultar.

## Estados y umbrales

Los umbrales iniciales son configurables en `config.json > vigencia > maxDiasSinActualizar`:

| Frente | Días calendario |
|---|---:|
| Operaciones (ops) | 2 |
| Costos (cos) | 7 |
| Inventario (inv) | 1 |

Son valores iniciales de la interfaz, no acuerdos de servicio validados. Un frente solo muestra Vigente cuando todas las fuentes consultadas tienen fechas completas y ninguna supera su umbral. Una fuente con error, sin registros, con fecha faltante, inválida o futura impide certificar el conjunto. Cuando hay varias fechas se considera la más antigua, no solo la más reciente.

## Contrato para las fuentes

No se modificaron hojas ni procesos externos. Para habilitar fechas en las fuentes que aún no las entregan, su responsable debe incorporar:

- `FECHA_ACTUALIZACION_FUENTE`: timestamp fijo escrito por el proceso de carga **después** de terminar correctamente.
- `DATOS_HASTA`: fecha real del corte de información representado.

Se admite una columna con el mismo timestamp de lote en cada registro, o una fila de metadatos en las primeras ocho filas con etiqueta y valor adyacente. Evitar AHORA()/NOW(): cambiaría al recalcular y no probaría que los datos fueron actualizados. Si se usan fechas por registro, la franja muestra su rango y detecta registros sin fecha; no supone que la última fila actualizada certifique todo el archivo.

Formatos admitidos: `YYYY-MM-DD`, `YYYY-MM-DD HH:mm[:ss]`, ISO con zona y `DD/MM/YYYY[ HH:mm[:ss]]`. Se recomienda ISO con zona explícita.

Alias de actualización reconocidos: FECHA_ACTUALIZACION, FECHA_ACTUALIZACION_FUENTE, ULTIMA_ACTUALIZACION, ACTUALIZADO_EN, SOURCE_UPDATED_AT. Alias de corte: FECHA_CORTE_DATOS, DATOS_HASTA, DATA_THROUGH. Espacios, guiones y tildes se normalizan. Campos genéricos como FECHA, FECHA COSTEO o FECHA CIERRE no se interpretan como actualización del origen.

## Validación

- 13 pruebas nuevas de fechas, corte independiente, campos ambiguos, fechas inválidas/futuras, registros sin fecha, fuentes mixtas, umbrales y persistencia ante refresco/error.
- Se mantienen las 14 pruebas del lote anterior.
- Navegador: se comprobó aislamiento de los tres frentes y presentación separada de consulta, actualización y período.
- La lectura ampliada de INV_Resumen e INV_Bodegas encuentra Fecha_Actualizacion fuera del rango anterior. Sus columnas adicionales solo se usan para vigencia; los cálculos reciben el mismo conjunto de columnas anterior.
- En las capturas revisadas, INV_Resumen, INV_Bodegas e INV_Movimientos declaran 2026-07-10 20:03. Las fuentes sin timestamp explícito permanecen sin fecha verificable.

Verificación adicional en navegador: Actualizar conserva la fecha del origen; la franja permanece al cambiar a Rotación; el filtro de Costos 2025 muestra enero–diciembre de 2025 y último costeo 30/12/2025. Se restauró 2026 después de la prueba. En pantalla estrecha la franja se adapta a una columna; el contenedor general del tablero conserva desbordamientos de navegación preexistentes que quedan fuera de este cambio.

## Regla confirmada para TEX_Lotes y EU_Lotes — 15 de septiembre de 2026

Gerencia confirmó que la fecha de creación de la última OP coincide con la generación y carga del último informe. En estas dos hojas, la columna F_Programacion contiene esa fecha de creación. Si no existe un campo explícito de actualización, se utiliza su máximo válido como actualización del informe completo, no como horizonte de programación ni como fechas distintas de actualización por fila. El detalle explica el criterio tanto en las áreas como en Gerencia General.

Un campo explícito de actualización tiene prioridad. La regla no se aplica a otras hojas. Fechas vacías, inválidas o futuras mantienen sus avisos; una fuente fallida no se certifica por conservar una fecha anterior. No se deduce un corte de existencias o del período a partir de esta regla. Se admiten días y meses con uno o dos dígitos en fechas colombianas, siempre con validación de calendario.

## Actividad registrada de módulos — 15 de septiembre de 2026

La actividad y la fecha de carga se presentan por separado. La última actividad del módulo se obtiene de días con producción, minutos reales o ingresos mayores a cero, el mismo criterio de días activos de Seguimiento Diario. Se excluyen días que solo tienen planificación (metas o minutos teóricos), fechas futuras y días inexistentes en el mes configurado. No se modifica ninguna fórmula de indicadores.

Un módulo consultado correctamente y con actividad pero sin timestamp de carga muestra “Datos registrados”. La columna de carga aclara “No informada por la fuente”; no significa que el módulo esté vacío o sin datos recientes. Este estado no certifica la fecha de carga ni el cierre completo del período. Los errores de consulta y los umbrales de vigencia mantienen su evaluación independiente. Las fechas del resumen corresponden solo a las fuentes que informan actualización; el contador aclara que las restantes carecen de fecha de carga, no necesariamente de datos.
