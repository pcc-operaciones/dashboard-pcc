# Versión 2 — control del cambio

Fecha de inicio: 14 de septiembre de 2026.

## Objetivo

Mantener disponible la versión actual, preparar y comparar la nueva versión y publicar únicamente después de su validación. Se usa el mismo repositorio para conservar historial y revisión de diferencias.

## Referencia anterior

- Rama de producción: `main`.
- Commit de referencia: `205395e2b34a6f16e42449296f601fab279b1ffa`.
- Etiqueta: `baseline/pre-v2-2026-09-14`.
- Rama de trabajo: `codex/dashboard-v2`.
- Reproducción: servidor local documentado en README, rutas `/before/` y `/after/`.

La referencia conserva el código. Las capturas locales de Sheets conservan respuestas para la comparación, pero no constituyen un respaldo integral de las hojas ni de su historial.

## Lote 1 — confiabilidad

Implementado:

- Corrección de sintaxis de config.json y aviso visible si no se puede utilizar.
- Registro de estado por fuente, errores y hora de consulta.
- Exclusión de fuentes de Operaciones sin configuración explícita del período y de hojas duplicadas.
- Agregación ponderada de eficiencia, cumplimiento y rentabilidad en resumen y detalle de procesos.
- Eliminación de la sustitución automática del inventario por datos de ejemplo.
- Ocultamiento del inventario si falla una fuente principal; posibilidad de reintentar.
- Período de movimientos derivado de los meses presentes, con advertencia de vigencia y meses faltantes.
- Fórmula de rotación común a resumen y detalle; cobertura por línea calculada con sus referencias.
- Eliminación de historia simulada de obsolescencia y de reconstrucción no sustentada de rupturas.
- Conservación de rutas y descripciones de EU Línea al cargar trazabilidad.
- Inclusión de movimientos EAC/AIC; Cobros vacío muestra cero.
- Actualizar en el frente Inventario llama a la carga de inventario.
- Pruebas de fórmulas, configuración, selección de fuentes y fallos.

## Comparación observada

Consulta local del 14 de septiembre de 2026. Son resultados de esta captura, no cifras certificadas.

| Punto | Antes | Después |
|---|---|---|
| Configuración mensual | JSON inválido; usa valores incrustados | JSON válido; aplica las fuentes configuradas |
| Rotación inventario | 2,8 en Resumen y 6,4 en Rotación | 7,8 en ambos, con período abril–julio de 122 días |
| Cobros sin existencias | 1 unidad en tarjeta y 0 en tabla | 0 en tarjeta y tabla |
| Historia de obsolescencia | Meses anteriores simulados | Solo corte actual |
| Fallo de fuente principal de inventario | Sustitución por muestra | Indicadores ocultos y error persistente |

El cambio de rotación combina unificación de fórmula y sustitución del período fijo de 150 días. No representa un aumento real de desempeño.

## Pendientes que impiden certificar el lanzamiento

1. **EU Moda:** el archivo configurado coincide con EU. Las hojas EF TT1, EF TT2, EF TT3 y EF M7 no se encuentran. Confirmar el archivo y los nombres correctos con el responsable de las hojas.
2. **Presentación:** PREU2 no tiene ID en config.json. La entrada extra PRES|PRES_EU tiene una clave compuesta y una fuente anterior. Ambas se excluyen del resumen hasta validar ubicación y período.
3. **Módulos:** EF M4 aparece por dos rutas en la misma fuente. Se conserva la asignación explícita de config.json y se excluye la repetida. Confirmar además la clasificación de EF PRESC, actualmente configurada dentro de EU.
4. **Inventario:** movimientos disponibles de abril a julio de 2026. Validar actualización de agosto/septiembre y fecha de corte real de existencias. El cálculo calendario supone meses completos salvo el mes actual.
5. **Valorización:** existen registros con stock y costo cero y valores monetarios que requieren conciliación. No se modificaron montos de origen ni su escala sin respaldo.
6. **Costos:** falta conciliar rentabilidad ponderada, totales, filtros y exportaciones con el responsable del frente.
7. **Indicadores restantes:** revisar alcance de filtros, alertas solapadas, tendencias y contenidos fijos; distinguir claramente estimaciones de historia real.
8. **Acceso:** revisar restricciones de las claves de lectura originales y visibilidad de las hojas. No se cambiaron permisos.
9. **Calidad visual:** revisar móvil, accesibilidad, exportaciones y todos los recorridos después de resolver las fuentes.

## Siguientes lotes

1. Conciliar las fuentes e indicadores pendientes y dejar un diccionario validado de métricas.
2. Mejorar navegación, jerarquía visual, filtros y estados vacíos; validar los tres frentes y exportaciones.
3. Preparar revisión final con comparativa, pruebas y notas de versión.

## Lanzamiento

- Mantener los cambios en la rama de desarrollo hasta cerrar los pendientes.
- Preparar una solicitud de integración a main con la lista final de cambios y evidencia.
- Verificar qué rama y configuración publica el sitio antes de integrar.
- Revisar y aprobar la nueva versión con el usuario.
- Tras la aprobación, integrar y publicar; etiquetar el lanzamiento.
- Verificar los tres frentes en producción. Si falla, revertir el cambio de lanzamiento y desplegar nuevamente la versión anterior. Un respaldo de código no revierte cambios en datos externos.
