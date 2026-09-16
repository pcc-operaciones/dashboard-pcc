# Históricos de Inventario PT — piloto de conservación

Estado: primer bloque implementado y probado localmente. Pendiente de instalar y validar en Apps Script. No está conectado al dashboard publicado.

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

## Instalación de prueba — una sola vez

La prueba se realiza en un proyecto asociado a un Sheet de prueba. El script actual puede continuar atendiendo el tablero mientras se valida este proceso.

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

Validación local realizada: 81 pruebas automatizadas aprobadas, incluidas 26 del nuevo histórico. Lectura del núcleo verificada con los cuatro archivos suministrados, sin modificarlos ni incorporarlos al repositorio. Las fechas usadas en esa comprobación son parámetros de prueba, no una certificación del corte de esos inventarios.

## Siguientes bloques del plan

1. Instalar el piloto y validar una primera carga con corte real declarado.
2. Conectar la consolidación acumulada de movimientos, controles de cobertura y cálculos de indicadores. Resolver la base de costos y antigüedad antes de sustituir esos resultados del proceso actual.
3. Publicar tablas de consulta compatibles con el tablero y probar recuperación ante fallos de publicación.
4. Incorporar el selector de cortes disponibles, series mensuales y fechas visibles en Inventario PT y Gerencia General. Evitar presentar períodos incompletos como meses cerrados.
5. Comparar ambos procesos con una carga real, activar el nuevo flujo y documentar la operación rutinaria mínima.

El nuevo selector y los indicadores históricos todavía no están implementados. Ningún archivo del dashboard publicado cambia en este primer bloque.

## Archivos técnicos

- `scripts/inventory-history/core.js`: reglas portables, validación y versiones.
- `apps-script/inventory-history/Code.gs`: acceso a Drive, respaldos, conversiones y estado.
- `apps-script/inventory-history/CargaHistorica.html`: formulario del paquete.
- `apps-script/inventory-history/config.example.json`: configuración sin credenciales ni ID reales.
- `scripts/inventory-history/build-bundle.cjs`: genera el paquete instalable.
- `tests/inventory-history*.test.cjs`: pruebas del núcleo y del adaptador.

El estado aceptado se referencia con `PCC_HIST_STATE_FILE`. Cada lote conserva originales, tablas convertidas, metadatos y `corte.json`. El adaptador escribe un nuevo archivo de estado, verifica que pueda leerse y después cambia esa referencia. No actualiza las hojas `INV_*` existentes.

Referencias de implementación: [LockService](https://developers.google.com/apps-script/reference/lock/lock-service), [conversión mediante Drive API](https://developers.google.com/workspace/drive/api/guides/manage-uploads), [límites de Apps Script](https://developers.google.com/apps-script/guides/services/quotas).
