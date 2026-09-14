# Revisión visual — avisos y gráficos

Fecha: 14 de septiembre de 2026. Rama: codex/dashboard-v2.

## Aplicado

- Aviso de vigencia compacto, en una línea en escritorio, con fondo neutro y estado expresado con texto.
- Fecha del origen siempre visible; período, fuentes, errores y observaciones se consultan con Ver detalle.
- Se conservan las fechas reales y las alertas de atraso o falta de información.
- Las conexiones y observaciones existentes se agrupan dentro del detalle, sin ocupar otra franja.
- Se elimina la banda de error repetida de Operaciones y la notificación flotante de conexión correcta de Inventario.
- Los errores que impiden cargar el inventario conservan su indicación y posibilidad de reintento.
- Se corrige el rótulo del encabezado al regresar desde Costos a Operaciones.
- El detalle admite ratón y teclado; el control ocupa una fila de al menos 44 px.

## Propuestas para los gráficos — pendientes de implementación

| Prioridad | Vista y hallazgo | Cambio recomendado | Criterio de aceptación |
|---|---|---|---|
| Alta | Inventario / Días de inventario: se observa nulld y un valor con muchos decimales | No dibujar etiquetas de valores ausentes; redondear días y marcar ausencia de datos | Ningún null/NaN/Infinity ni etiquetas extensas en pantalla |
| Alta | Inventario / Obsolescencia: una gráfica de seis meses contiene un único punto actual | Mostrar valor actual contra meta y aviso breve de histórico no disponible; usar línea solo cuando existan cortes reales | El gráfico no sugiere una historia o fecha de corte que la fuente no confirma |
| Alta | Inventario: meses sin registros se presentan como cero y algunos títulos no describen la medida | Separar cero de dato no disponible; titular Despachos por mes (unidades); señalar períodos parciales | El usuario distingue falta de datos de ausencia de movimiento |
| Alta | Operaciones: anillos de eficiencia se saturan al 100% aunque Corte indica 155% | Probar barras horizontales con marcador de meta y escala compartida por indicador | Comparar varios procesos y reconocer resultados por encima de la meta sin abrir cada tarjeta |
| Media | Operaciones: tarjetas altas con pequeñas minigráficas y mucho espacio vacío | Reducir altura, ampliar cifras y ofrecer una comparación ordenada por proceso; conservar el detalle al abrir | Más procesos comparables en una pantalla sin reducir legibilidad |
| Media | Inventario: títulos y subtítulos de tarjetas se recortan o compiten con la meta | Simplificar etiquetas, permitir dos líneas y reservar un lugar fijo para unidad y meta | Ningún nombre de indicador truncado en el ancho de uso habitual |
| Media | Costos: gráfica mensual útil, pero las referencias de años y promedios añaden series | Conservar la comparación mensual, simplificar leyenda y dejar los promedios históricos opcionales; marcar el mes incompleto | Se identifican con facilidad medida, año, meta y período |
| Media | Inventario / Cobertura: se usan estimaciones con stock actual | Rotular Estimación junto al título y explicar su cálculo al desplegar | La estimación no se interpreta como inventario histórico |
| Media | Rankings de referencias y bodegas | Preferir barras horizontales ordenadas y cifras legibles; conservar el anillo de rupturas de tres categorías si aporta lectura rápida | Comparaciones precisas sin depender de ángulos ni solo del color |
| Media | Navegación y gráficos: abundan letras pequeñas, iconos emoji y convenciones distintas | Unificar tamaño de texto, iconos vectoriales, formato numérico, colores y estilos de líneas | Valores, metas, unidades y estados siguen las mismas convenciones en los tres frentes |
| Media | Accesibilidad y móvil | Ampliar etiquetas, permitir tabla de valores, simplificar ejes y corregir el desbordamiento del contenedor general | Lectura por teclado y en pantalla estrecha; significado comprensible sin depender solo del color |

## Dirección visual recomendada

Conservar la identidad azul oscuro y verde del proyecto. Usar el color principalmente para identificar series y excepciones; fondos neutros, bordes finos y menos elementos decorativos. Mantener las acciones y explicaciones secundarias desplegables.

Orden sugerido: corregir primero etiquetas, ausencia de datos y coherencia temporal; después mejorar las comparaciones de Operaciones; finalmente unificar tarjetas, tipografía y navegación.

## Método y alcance

Se utilizaron las habilidades instaladas frontend-design y ui-ux-pro-max, la revisión del código de los gráficos y la inspección en navegador de los tres resúmenes. No fue necesario instalar habilidades adicionales.

La búsqueda local de gráficos devolvió recomendaciones para barras con metas y series temporales. La búsqueda de disclosure no devolvió coincidencias; para los avisos se aplicó la regla general progressive-disclosure de references/quick-reference.md y la solicitud explícita del usuario.

Los cambios de este lote se limitan a avisos y al rótulo del frente. Las propuestas de gráficos siguen pendientes. No se alteraron fórmulas, cifras ni fuentes.
