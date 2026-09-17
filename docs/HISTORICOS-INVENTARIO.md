# Históricos de Inventario PT — piloto de conservación

Estado al 17 de septiembre de 2026: piloto autorizado y configurado por el propietario; primera carga conservada con corte declarado 2026-09-17. Repetición SIN_CAMBIOS confirmada y activador automático operativo (15:22:42, 16,669 s; 15:37:42, 5,319 s). La consulta histórica se integra en este segundo bloque.

## Resultado de la primera carga real

- La configuración del propietario se completó a las 14:40 del 17/09/2026. El menú Histórico PT ya aparece mediante el activador de apertura.
- Se autorizaron los dos ámbitos adicionales del piloto. El manifiesto activo tiene los seis ámbitos documentados en manifest.pilot.example.json; la protección con cuatro ámbitos describe la etapa previa a esa autorización.
- El formulario guardó un corte declarado de 17/09/2026 y un período de movimientos de 17/05/2026 a 17/09/2026, con integridad confirmada por el usuario. Son fechas declaradas, no inferidas del contenido del ERP.
- Un intento desde la cuenta colaboradora falló al acceder a la carpeta privada de respaldos del cliente. Se mantuvo la carpeta privada y se procesó desde la cuenta propietaria.
- procesarHistoricoPT finalizó a partir de las 15:03:04, en 84,08 segundos, con estado Completada. La consulta de estado mostró CARGA_CONSERVADA / 2026-09-17 / EN_CURSO.
- EN_CURSO se refiere al mes abierto; la importación terminó. El resultado confirma que pasó la validación técnica del importador. La comparación independiente de los totales del corte real y la validación de los futuros indicadores siguen siendo pasos distintos.
- El usuario confirmó SIN_CAMBIOS al repetir el paquete. El activador por tiempo ya funciona bajo la cuenta que tiene acceso a los respaldos. No se requiere reinstalarlo.

## Acuerdos del proceso

- Conservar información desde la puesta en marcha; no reconstruir meses anteriores.
- Mantener la descarga de cuatro Excel: inventarios y movimientos de EU y TEX.
- Automatizar respaldo, validación y conservación; pedir al operador únicamente información que el ERP no entrega.
- El ERP no incorpora el corte ni el período exportado. Por eso habrá un único formulario por paquete: corte común de inventarios, movimientos desde y movimientos hasta. Las exportaciones de ambas empresas deben usar esas mismas fechas.
- El formulario vincula las fechas al contenido de los cuatro archivos. Reemplazar cualquiera invalida la declaración anterior. No se usa la hora de carga, la fecha del computador ni el último movimiento para inventar el corte.
- El operador confirma si la exportación incluye todos los registros solicitados. Si alcanzó el límite del ERP o no puede confirmarlo, el paquete se respalda sin sustituir el inventario aceptado. El límite numérico del ERP sigue pendiente de confirmar.

## Frecuencia operativa confirmada

La descarga y carga del paquete se realiza entre tres veces por semana y diariamente. No se exige una carga cada día ni se presupone un calendario fijo de lunes, miércoles y viernes.

- Cada carga válida genera un corte con su fecha real. En los días sin carga se conserva el último corte aceptado y se muestra esa fecha; no se crean fotografías diarias copiadas ni valores cero.
- El formulario se completa solo cuando se carga un paquete, nunca por cada ejecución automática ni por cada día transcurrido.
- La revisión automática cada 15 minutos es una comprobación técnica. No representa la frecuencia de actualización del ERP ni modifica la fecha del dato.
- La siguiente exportación de movimientos debe cubrir también los días transcurridos desde el período previamente aceptado. La ventana móvil permite hacerlo, siempre que esté completa y no haya sido truncada por el ERP. Días sin carga y días sin cobertura de movimientos son situaciones distintas.
- Al integrar las alertas de vigencia, no se considerará atraso el simple hecho de no haber cargado ayer. El umbral será configurable según la cadencia acordada y los días de operación. Como aún no se conocen días fijos ni calendario laboral, esta frecuencia no se convierte automáticamente en una regla de 24 o 48 horas. Definir el margen operativo antes de activar esa alerta; no afecta los avisos por fallos de importación o cobertura incompleta.
- Para el selector histórico se ofrecerán cortes efectivamente guardados. Las series de movimientos podrán incluir días entre cargas solo cuando exista cobertura completa; las existencias de esos días no se inventarán.
- El resumen mensual distinguirá el último corte disponible del mes de un cierre exacto. No se suman las existencias de las sucesivas cargas: son fotografías del mismo inventario.
- No es necesario subir los archivos justo el último día del mes: una carga posterior puede traer un inventario exportado con corte al último día, porque el ERP permite seleccionar un corte pasado. Ese corte y su cobertura se validan con las mismas reglas. Si no se dispone de ese corte, se conserva el último disponible con su fecha y sin presentarlo como cierre exacto. No se impone una descarga extraordinaria solo para completar la gráfica.

Este ajuste queda incorporado al diseño de la siguiente etapa. El piloto actual conserva cargas y fechas sin generar alertas de atraso por falta de una carga diaria; las alertas y el selector del dashboard todavía no están conectados al histórico.

## Qué está implementado

1. Respaldo de los cuatro Excel en una carpeta privada de Drive, con huellas SHA-256. Nunca se borran los archivos originales.
2. Conservación de filas de inventario y movimientos con empresa, referencia, talla, color, bodega y fecha completa.
3. Validación de estructura, conciliación de existencias, entradas y salidas, costos, fechas, claves y cobertura declarada.
4. Cargas versionadas. Repetir el mismo contenido y declaración no crea otra carga aceptada. Una corrección genera una nueva versión.
5. Estado del último inventario válido y un índice mensual. Un fallo antes de terminar mantiene el estado anterior.
6. Conversión con puntos de reanudación entre archivos; una ejecución posterior reutiliza conversiones ya guardadas.
7. Formulario único y activador de revisión cada 15 minutos, con espera de 10 minutos después de la última modificación de archivos.

El activador solo conserva lo que alcanza a observar. No puede recuperar una versión que el operador haya reemplazado antes de ser respaldada. Antes de volver a sustituir los archivos se debe comprobar `CARGA_CONSERVADA` o resolver la incidencia mostrada en `Ver estado`.

## Qué no debe inferirse

- Los Excel actuales de inventario no traen valor del inventario ni antigüedad inicial. Ambos campos permanecen sin dato en el nuevo histórico; no se sustituyen por cero ni por costos recientes de movimientos.
- Los costos de entrada y salida del movimiento son totales. El costo unitario se obtiene dividiendo por la cantidad correspondiente; no se vuelve a multiplicar el total como si fuera unitario.
- Se conservan ambas columnas de entrada y salida para todos los tipos de documento, incluidos TRI, ENS, EOP y AIC.
- Los archivos actuales no tienen documento y línea suficientes para identificar inequívocamente una transacción. No se eliminan filas por coincidencia de referencia/fecha. El núcleo dispone de sustitución de intervalos completos para resolver solapamientos; su materialización acumulada y publicación se conectarán en el siguiente bloque.
- Las filas anteriores al inicio que vengan dentro de la ventana exportada se conservan en el respaldo, pero no autorizan reconstruir ni presentar meses anteriores como histórico validado.
- Una declaración humana de integridad no permite detectar por sí sola todas las truncaciones del ERP. Si se conoce el máximo de filas, configurar `erpRowLimit`; alcanzar ese valor bloquea la aceptación y requiere exportar períodos más cortos.

## Cortes y meses

- Se conserva cada corte recibido. Elegir una fecha pasada en el futuro selector del tablero deberá ofrecer cortes disponibles y distinguirlos de fechas sin exportación.
- Dentro del mes: `EN_CURSO`.
- Corte al último día del primer mes, si el histórico comenzó después del día 1: `PRIMER_MES_PARCIAL`.
- Corte al último día del mes con inventarios confirmados y movimientos completos de ambas empresas para todo ese mes: `CIERRE_EXISTENCIAS`.
- Si falta esa cobertura: `CIERRE_PENDIENTE_COBERTURA`.
- No se certifica valoración ni antigüedad con el cierre de existencias.
- Si no se exporta un inventario al último día del mes, el último corte disponible no se cambia de fecha para aparentar un cierre. La automatización no puede generar una exportación del ERP.

## Preparación realizada en el proyecto del cliente

Se confirmó que BPT CMI está vinculado a la hoja de inventario y que su propietario sigue siendo el cliente. El servicio avanzado Drive ya está configurado en v3. Para conservar esa propiedad y reducir la configuración manual, se añadieron archivos separados al mismo proyecto:

- InventarioHistorico.gs: núcleo y adaptador del piloto.
- CargaHistorica.html: formulario de fechas.
- InstalarHistorico.gs: contenido de Integration.gs, instalador que toma los cuatro ID de CFG.

Se compararon los tres archivos pegados con el paquete local y se confirmó que Código.gs permanece íntegro. No se ejecutó ninguna función, no se crearon respaldos ni activadores y no se publicaron nuevas implementaciones.

Al añadir el formulario y la comprobación de propietario, la detección automática de Google amplió los ámbitos de cuatro a seis. Para que el proceso original no quede pendiente de nuevos permisos, se fijaron explícitamente en appsscript.json los mismos cuatro ámbitos que tenía antes: Drive, Spreadsheets, ejecución de activadores y solicitudes externas. Se preservaron la zona horaria, V8, el registro de excepciones y Drive v3. La vista de información del proyecto confirmó nuevamente cuatro ámbitos.

**Durante la preparación, el piloto no debía ejecutarse con el manifiesto de protección.** El paso a los seis ámbitos se coordinó con el propietario siguiendo esta secuencia:

1. Habilitar de forma revisada los ámbitos script.container.ui (mostrar el formulario) y userinfo.email (verificar que configura la cuenta propietaria), preservando los demás campos del manifiesto. Los archivos manifest.*.example.json documentan ambos estados; no reemplazar manifiestos de otros proyectos sin comprobar sus campos.
2. El cliente autoriza esos permisos desde su propia sesión y ejecuta configurarPilotoHistoricoPT. El instalador comprueba propietario y acceso a las cuatro fuentes, crea una carpeta privada y configura el menú. Repetirlo conserva la configuración existente. Solo crea el activador de apertura del menú; no el de importación periódica.
3. En la hoja, registrar las fechas reales del primer paquete y procesarlo manualmente. Verificar conteos y recuperación antes de instalar la importación periódica.
4. Si se pospone o falla la autorización, restablecer inmediatamente el manifiesto con los cuatro ámbitos originales. No dejar los activadores de producción esperando la autorización del piloto.

Esta instalación complementaria sustituye, para este cliente, la necesidad de crear una hoja y un proyecto de prueba bajo la cuenta del desarrollador. El almacenamiento y estado del histórico están separados de las hojas INV_*.

## Instalación de prueba — una sola vez

Alternativa para instalaciones independientes: realizar la prueba en un proyecto asociado a un Sheet de prueba. Para BPT CMI seguir la preparación del apartado anterior.

1. Crear un Google Sheet de prueba y abrir **Extensiones → Apps Script**.
2. Ejecutar localmente `node scripts/inventory-history/build-bundle.cjs`. Los archivos listos para copiar quedan en `.review/inventory-history/`, excluidos de Git.
3. Pegar `InventarioHistorico.gs` en un archivo de código del proyecto. Crear un archivo HTML llamado **CargaHistorica** y pegar `CargaHistorica.html`. El `.gs` generado ya incluye el núcleo y el adaptador: no copiarlos otra vez por separado.
4. Agregar el servicio avanzado **Drive API v3** desde **Servicios**. Si el proyecto utiliza un proyecto Cloud propio, verificar allí la habilitación de Drive API.
5. Crear una carpeta privada de respaldo. No usar una carpeta pública ni publicar sus archivos con GitHub Pages.
6. En **Configuración del proyecto → Propiedades de secuencia de comandos**, crear `PCC_HIST_CONFIG`. Su valor es el contenido de `config.example.json`, reemplazando la carpeta y los cuatro ID por los reales. Los ID deben corresponder a cuatro archivos diferentes y mantenerse al reemplazar su contenido. Si la rutina actual elimina y recrea archivos con ID nuevos, hay que adaptar la localización antes de activar el piloto.
7. En el proyecto de prueba agregar `function onOpen(){ menuHistoricoPT(); }`. Guardar, ejecutar `menuHistoricoPT` una vez y autorizar con la cuenta que tiene acceso a los Excel y la carpeta. Reabrir el Sheet para ver **Histórico PT**.
8. Subir los cuatro archivos con el mismo corte y período. Abrir **Histórico PT → Registrar fechas de la carga**, completar las tres fechas y confirmar integridad solo si corresponde. No adivinar el corte de los archivos de muestra.
9. Cuando lleven 10 minutos sin modificaciones, ejecutar **Procesar paquete** y revisar **Ver estado**. Si las conversiones requieren continuar, volver a ejecutar; las anteriores quedan guardadas.
10. Validar la prueba con los controles de la sección siguiente. Después ejecutar `instalarTriggerHistoricoPT` una sola vez para activar las revisiones automáticas. Esta función no elimina los activadores del script anterior.

Para detener el piloto, eliminar únicamente el activador de `procesarHistoricoPT` desde Apps Script. Los respaldos y el estado aceptado permanecen en Drive.

## Validación antes de conectar el tablero

- Comparar unidades y filas de EU y TEX contra los cuatro Excel, manteniendo las empresas separadas.
- Repetir el paquete y comprobar que no cambian la versión aceptada ni la fecha del corte.
- Reemplazar un Excel y comprobar que la declaración anterior no se reutiliza.
- Simular un archivo incorrecto y verificar que el último corte válido permanece disponible.
- Confirmar que las cuatro fuentes son las correctas y que el mecanismo de reemplazo mantiene los ID configurados.
- Verificar duración real, permisos y conversión con la cuenta del usuario. Las pruebas locales usan dobles de los servicios de Google y no sustituyen esta comprobación.

Validación local realizada: 84 pruebas automatizadas aprobadas, incluidas 29 del histórico y su instalador. Lectura del núcleo verificada con los cuatro archivos suministrados, sin modificarlos ni incorporarlos al repositorio. Las fechas usadas en esa comprobación son parámetros de prueba, no una certificación del corte de esos inventarios.

## Siguientes bloques del plan

1. Completar la prueba de repetición de la primera carga real y activar la importación periódica desde la cuenta propietaria.
2. Conectar la consolidación acumulada de movimientos, controles de cobertura y cálculos de indicadores. Resolver la base de costos y antigüedad antes de sustituir esos resultados del proceso actual.
3. Publicar tablas de consulta compatibles con el tablero y probar recuperación ante fallos de publicación.
4. Incorporar el selector de cortes disponibles, series mensuales y fechas visibles en Inventario PT y Gerencia General. Evitar presentar períodos incompletos como meses cerrados.
5. Comparar ambos procesos con una carga real, activar el nuevo flujo y documentar la operación rutinaria mínima.

El segundo bloque añade Histórico dentro de Inventario PT y un acceso desde Gerencia General. La situación de despliegue y las comprobaciones de este bloque se documentan abajo.

## Archivos técnicos

- `scripts/inventory-history/core.js`: reglas portables, validación y versiones.
- `apps-script/inventory-history/Code.gs`: acceso a Drive, respaldos, conversiones y estado.
- `apps-script/inventory-history/CargaHistorica.html`: formulario del paquete.
- `apps-script/inventory-history/config.example.json`: configuración sin credenciales ni ID reales.
- `scripts/inventory-history/build-bundle.cjs`: genera el paquete instalable.
- `tests/inventory-history*.test.cjs`: pruebas del núcleo y del adaptador.

El estado aceptado se referencia con `PCC_HIST_STATE_FILE`. Cada lote conserva originales, tablas convertidas, metadatos y `corte.json`. El adaptador escribe un nuevo archivo de estado, verifica que pueda leerse y después cambia esa referencia. No actualiza las hojas `INV_*` existentes.

Referencias de implementación: [LockService](https://developers.google.com/apps-script/reference/lock/lock-service), [conversión mediante Drive API](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [límites de Apps Script](https://developers.google.com/apps-script/guides/services/quotas).

## Consulta histórica — segundo bloque

- Se añade Histórico: cortes disponibles, comparación con un corte anterior, empresa, bodega, existencias, comprometidas, disponibles, evolución, tabla mensual, búsqueda por referencia y CSV con fecha de corte.
- El selector afecta solo a Histórico. Las otras vistas conservan la consulta actual y sus fórmulas; no se mezclan sus métricas con el corte elegido. Gerencia General incorpora un acceso a la consulta.
- El acumulado sustituye los intervalos completos por empresa, conserva lo que queda fuera de la ventana y agrupa movimientos por día y bodega. Los originales y filas detalladas continúan en el archivo privado. Dos filas legítimas de la misma referencia/fecha se suman, no se deduplican.
- Los movimientos se consultan con la última corrección conservada y se limitan a la fecha elegida. Las fotografías de existencias conservan su fecha; una corrección de la misma fecha publica su última versión válida. El primer mes comienza en la puesta en marcha, sin cargar historia anterior.
- Entradas/salidas incluyen todos los documentos y traslados. No se etiquetan como ventas ni despachos. Un período sin cobertura muestra guion; un período completo sin movimientos muestra cero.
- Solo cortes completos aparecen en el selector. No hay stock inventado entre cargas. Un corte de fin de mes no certifica por sí mismo costos, antigüedad ni cierre de movimientos.

### Publicación y recuperación

Publication.gs se incluye automáticamente en el paquete InventarioHistorico.gs junto con inventory-history-model.js. Usa CFG.OUTPUT_ID del proyecto del cliente; en instalaciones independientes requiere querySheetId en PCC_HIST_CONFIG. El mismo activador procesa y publica, incluso al encontrar SIN_CAMBIOS si existe una publicación pendiente. No crea otro activador ni necesita ámbitos adicionales.

La hoja existente recibe INV_Hist_Datos (fragmentos JSON agregados por empresa/referencia/bodega y series diarias) e INV_Hist_Control (un puntero). No cambia los permisos de Drive ni comparte los respaldos privados. Los datos de consulta heredan el acceso existente de la hoja del dashboard; no incluyen IDs privados, documentos ERP ni datos personales.

Los fragmentos se agregan, se releen y se verifican antes de actualizar el puntero de control. Las consultas verifican SHA-256 y el corte de cada detalle. Ante fallo, permanece disponible el puntero anterior; el archivo privado permite reanudar. No se borran filas de versiones anteriores. PCC_HIST_QUERY_FILE conserva el punto de reanudación, PCC_HIST_PUBLISHED_STATE evita reprocesar lo ya publicado y PCC_HIST_PUBLICATION_STATUS identifica incidencias en Ver estado.

El archivo histórico privado permanece como respaldo independiente de Sheets. La tabla de consulta limita su crecimiento a 250.000 filas de fragmentos y requiere revisión de capacidad antes de alcanzarlo. No se ofrece almacenamiento ilimitado. El índice se consulta una vez y los detalles se descargan solo para los cortes seleccionados.

### Validación del segundo bloque

- 94 pruebas automatizadas aprobadas: conservación, solapamientos, correcciones, fechas, separación EU/TEX, filtros por bodega, ausencia de cobertura, publicación interrumpida y reintento.
- Prueba visual con datos simulados, identificados como tales: selector, comparación, búsqueda sin coincidencias, filtros y primer corte sin comparación.
- Fallo de integridad simulado: se ocultan los resultados en lugar de mostrar datos parciales.
- Los datos simulados viven únicamente en .review y no se publican.
- Primera publicación automática real observada en el ciclo de las 15:52:42 del 17/09/2026. El corte 2026-09-17 se leyó desde Sheets con huellas verificadas; sus resúmenes EU/TEX concilian con las 845 filas agregadas del detalle publicado. Los resultados numéricos de la verificación permanecen en .review, fuera de Git. Esta conciliación comprueba la publicación y no sustituye la comprobación del corte declarado contra el ERP.
- Interfaz preparada para publicación en la misma dirección del dashboard; conserva el proceso actual.

Referencias: [escritura de rangos en Apps Script](https://developers.google.com/apps-script/reference/spreadsheet/range) y [lectura de valores en Sheets API](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get).
