/**
 * Parseo de los argumentos de `strapi/scripts/media-import.mjs`, separado del
 * script para poder testearlo SIN servidor, sin red y sin credenciales
 * (tests/media-flags.test.mjs). Puro: no lee `process.argv`, `process.env`, `fs`
 * ni la hora; recibe el arreglo y devuelve una decisión.
 *
 * La razón de existir de este archivo es una sola: `--dry-run` es el único guard
 * que tiene una herramienta que escribe en un CMS de producción, así que nadie
 * puede obtener `--apply` "por defecto" ni por descuido. Por eso:
 *
 *   · `--apply` a secas            → modo `aplicar` (el único que escribe),
 *   · nada, o `--dry-run` a secas  → modo `dry-run`,
 *   · `--dry-run` y `--apply` a la vez → modo `conflicto`: el script ABORTA con
 *     exit != 0 antes de mirar el entorno y antes de la primera petición. No se
 *     resuelve a favor de ninguno de los dos: una invocación que se contradice a
 *     sí misma no autoriza una escritura, y abortar es lo único que no se puede
 *     leer mal. (Con `--apply` ganando, el comportamiento que tuvo esta herramienta
 *     hasta la Tarea 10, se escribía PUT/POST sin imprimir `dry-run:`.)
 *   · cualquier otro argumento     → modo `invalido`, sin decidir nada.
 *
 * `--alias=<ruta>` (con el `=` obligatorio) pide el archivo de alias declarados;
 * ver el bloque ALIAS de ./media-manifest.mjs.
 *
 * @param {string[]} argv argumentos sin el ejecador ni la ruta del script,
 *   i.e. `process.argv.slice(2)`.
 * @returns {{ modo: 'dry-run'|'aplicar'|'conflicto'|'invalido', alias: string|null, desconocidas: string[] }}
 */
const PREFIJO_ALIAS = '--alias=';

export function parsearFlags(argv) {
  // `--alias=` con el valor vacío no es una ruta: cuenta como argumento suelto.
  const bien = (a) => a.startsWith(PREFIJO_ALIAS) && a.length > PREFIJO_ALIAS.length;
  const valorAlias = argv.find(bien);
  const desconocidas = argv.filter((a) => a !== '--apply' && a !== '--dry-run' && !bien(a));
  if (desconocidas.length) return { modo: 'invalido', alias: null, desconocidas };
  const aplica = argv.includes('--apply');
  const seco = argv.includes('--dry-run');
  const alias = valorAlias === undefined ? null : valorAlias.slice(PREFIJO_ALIAS.length);
  if (aplica && seco) return { modo: 'conflicto', alias, desconocidas: [] };
  return { modo: aplica ? 'aplicar' : 'dry-run', alias, desconocidas: [] };
}
