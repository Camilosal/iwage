/**
 * Las dos apps externas del ecosistema Iwagé.
 *
 * El Modelador y la Intranet se enlazan desde «Recursos» en la navegación
 * (src/config/site.ts y src/config/brands/meliponas.ts). Antes vivían en un panel
 * intermedio (/meliponas/herramientas) que se borró: una hoja propia para dos enlaces
 * daba más trabajo de mantenimiento que valor de navegación.
 *
 * La trazabilidad ya no aparece aquí. Sus tres fichas son páginas de contenido del frente
 * I+D (/meliponas/trazabilidad/{miel,cajas,polinizacion}), no herramientas del Meliponario.
 */

export const SIMULADOR_URL = 'https://simulacion.iwage.co';
export const INTRANET_URL = 'https://intranet.iwage.co';
