# Dashboard PCC

Dashboard estático con Gerencia General y las áreas de Operaciones, Costos e Inventario de Producto Terminado. Consulta Google Sheets desde el navegador.

## Versión principal

- Producción: rama `main`.
- Versión aprobada: `v2.1.0` (Gerencia General), 15 de septiembre de 2026.
- Desarrollo y revisión: `codex/gerencia-general`.
- Respaldo de la versión principal anterior: `v2.0.0`.
- Cambios de esta entrega: [docs/VERSION-2.1.md](docs/VERSION-2.1.md).
- Punto de partida: etiqueta `baseline/pre-v2-2026-09-14` (commit `205395e2b34a6f16e42449296f601fab279b1ffa`).
- Plan, criterios de aceptación y pendientes: [docs/VERSION-2.md](docs/VERSION-2.md).
- Definiciones de los cálculos modificados: [docs/INDICADORES.md](docs/INDICADORES.md).

Versión 2 autorizada para producción el 14 de septiembre de 2026. Incluye correcciones de confiabilidad, vigencia de fuentes y avisos compactos. Los pendientes de conciliación de datos y rediseño de gráficos siguen documentados.

Sitio: https://pcc-operaciones.github.io/dashboard-pcc/ (GitHub Pages, rama `main`, carpeta raíz).

## Comparación local

Con Node.js instalado, desde la carpeta del repositorio:

```sh
node scripts/review-server.cjs
```

Abrir http://127.0.0.1:4173/ y elegir **Antes** o **Versión nueva**. El servidor solo escucha en este equipo. Requiere acceso a Google Sheets para capturar por primera vez cada fuente.

El servidor conserva respuestas por archivo/hoja/rango en `.review/sources/`. Una misma consulta utiliza la misma captura en ambas versiones. Las fuentes que cambian al corregir la configuración se capturan por separado: las diferencias de cifras no representan por sí solas una mejora operacional. La carpeta está excluida de Git y no debe publicarse.

Los datos de esta comparación quedan congelados. Para una nueva sesión de capturas, detener el servidor y renombrar `.review/sources/` antes de iniciarlo nuevamente.

## Validación

```sh
node --test tests/*.test.cjs
git diff --check
```

No hay dependencias npm para estas pruebas ni para el servidor de comparación. Las páginas siguen utilizando sus bibliotecas externas originales.

## Vigencia de los datos

Cada frente muestra fechas del origen, período y detalle de sus fuentes. Ver [contrato de fechas y umbrales](docs/VIGENCIA-DATOS.md).

Propuestas de gráficos y cambios visuales: [revisión visual](docs/REVISION-VISUAL.md).

## Configuración

`config.json` define período, archivos, módulos y metas. El período del encabezado no certifica la vigencia del contenido de las hojas. Si la configuración falla, Operaciones no consulta automáticamente los archivos antiguos incrustados.

Las credenciales de lectura presentes en el código original mantienen pendiente una revisión separada de restricciones y acceso. No copiar claves ni respuestas de negocio a documentación, pruebas o comentarios.

## Gerencia General

Vista principal desde v2.1.0: [alcance, indicadores y administración](docs/GERENCIA-GENERAL.md). La navegación inicia en Gerencia General e integra Operaciones, Costos e Inventario PT; Logística y Ventas están previstas.

Revisión local: http://127.0.0.1:4173/after/#gg. Los compromisos se guardan en este navegador y se pueden exportar/importar; aún no existe administración compartida por roles.
