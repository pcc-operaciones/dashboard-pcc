# Versión 2.1.0 — Gerencia General

Lanzamiento aprobado por el usuario el 15 de septiembre de 2026.

## Cambios

- Gerencia General como entrada principal, con indicadores, estado de las áreas, alertas y seguimiento de compromisos.
- Operaciones, Costos e Inventario PT integrados; Logística y Ventas previstas para próximas entregas.
- Vigencia de módulos en línea basada en la última actividad real, excluyendo días únicamente programados.
- Fecha de generación y carga de TEX_Lotes y EU_Lotes según la última OP creada, conforme al criterio confirmado por Gerencia.
- Alertas y desplegables de las tarjetas limitados a errores, atrasos confirmados y desviaciones que requieren gestión.
- Avisos discretos y detalles desplegables; separación de las tarjetas de Operaciones respecto de Gerencia.

## Validación y publicación

- 55 pruebas automatizadas aprobadas; sintaxis de las páginas comprobada.
- Revisión en navegador de Gerencia, navegación de las áreas, fuentes afectadas y visibilidad de tarjetas.
- Publicación: rama main, raíz del repositorio, mediante GitHub Pages.
- Sitio: https://pcc-operaciones.github.io/dashboard-pcc/
- Etiqueta de esta entrega: v2.1.0.
- Respaldo de la versión anterior: v2.0.0, commit 744f5d068e1de828e0bceff3d95b83335d558e71.

## Alcance pendiente

Los compromisos se guardan por navegador y origen; no hay sincronización multiusuario ni permisos por gerente. Para trasladar compromisos desde la revisión local, exportar e importar el JSON en el sitio publicado. Publicar el código no corrige las fuentes externas pendientes de conciliación, documentadas en VERSION-2.md, ni certifica sus cifras.

## Reversión

Revertir en una nueva rama los commits comprendidos entre v2.0.0 y v2.1.0, validar y publicar la reversión en main sin reescribir el historial. La etiqueta v2.0.0 conserva el código anterior; las hojas externas y los compromisos locales no se restauran mediante Git.
