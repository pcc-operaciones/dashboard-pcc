# Validación del lote 1

Fecha: 14 de septiembre de 2026.

- 14 pruebas automáticas aprobadas con `node --test tests/data-quality.test.cjs`.
- Compilación sintáctica de los scripts de ambas páginas incluida en las pruebas.
- Revisión de Operaciones, WIP, Costos y las vistas Resumen, Rotación y Cobros de Inventario en navegador local.
- Rotación consistente: 7,8 en Resumen y Rotación con la captura abril–julio.
- Cobros vacío: cero en tarjeta y total de tabla.
- WIP: objetivo de 7.332 unidades/día leído de config.json; vuelve a mostrar días de inventario.
- Costos mantiene los 1.532 registros del filtro 2026 y los indicadores observados en la referencia.
- Operaciones informa las cuatro hojas ausentes de EU Moda y excluye fuentes sin período validado y duplicadas.
- La prueba de fallo ejecuta la función real de carga de inventario con una fuente principal que responde con error; verifica que los indicadores se ocultan, no quedan datos anteriores y puede reintentarse.
- Aparece un error de MutationObserver tanto en la referencia como en la versión nueva. No se encontraron llamadas a ese API en los archivos del proyecto; su origen no quedó identificado. Revisarlo durante la validación final en el navegador de uso habitual.
- Pendientes: conciliación con las hojas, exportaciones, móvil, filtros completos y aprobación funcional. No se considera una certificación de lanzamiento.
