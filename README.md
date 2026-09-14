# Dashboard PCC

Dashboard estático de Operaciones, Costos e Inventario de Producto Terminado. Consulta Google Sheets desde el navegador.

## Trabajo de la versión 2

- Producción: rama `main`.
- Desarrollo y revisión: `codex/dashboard-v2`.
- Punto de partida: etiqueta `baseline/pre-v2-2026-09-14` (commit `205395e2b34a6f16e42449296f601fab279b1ffa`).
- Plan, criterios de aceptación y pendientes: [docs/VERSION-2.md](docs/VERSION-2.md).
- Definiciones de los cálculos modificados: [docs/INDICADORES.md](docs/INDICADORES.md).

Esta rama contiene el primer lote de correcciones. Todavía no es la versión aprobada para producción.

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

Las credenciales de lectura presentes en el código original requieren una revisión separada de restricciones y acceso antes del lanzamiento. No copiar claves ni respuestas de negocio a documentación, pruebas o comentarios.
