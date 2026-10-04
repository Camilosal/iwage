import { SIMULADOR_URL, INTRANET_URL } from './tools';
import { meliponas } from './brands/meliponas';
export const SITE = {
  name: 'Iwagé',
  tagline: 'Meliponario & Biotecnología Nativa',
  url: process.env.APP_URL || 'https://iwage.co',
  whatsapp: '+573026693366',
  email: 'info@iwage.co',
  instagram: '@iwage.meliponario',
  location: 'Corredor Ambalá, Ibagué, Tolima',
} as const;

export type NavChild = { label: string; href: string; external?: boolean };
export type NavItem = { label: string; href?: string; children?: NavChild[] };

// El grupo «Herramientas» se disolvió: su hoja (el panel) y la principal de trazabilidad ya no
// existen. Los dos accesos externos —Modelador e Intranet— viven ahora en «Recursos», que es lo
// que quedaba de ese menú una vez borradas las dos páginas internas.
//
// Estándar de «Ayuda»: dentro de la navegación de una marca, Ayuda apunta al centro de ayuda del
// propio subsitio (/meliponas/ayuda), no al hub genérico (/ayuda/). Las seis marcas tienen hoja
// propia y las seis configs de `src/config/brands/` ya lo cumplían; esta línea era la única que
// se salía. El hub genérico sigue siendo la puerta del ecosistema completo — desde /legal/ y desde
// el cierre «Guía de uso» de cada ayuda de marca, que son los dos sitios donde tiene sentido.
export const NAV_LINKS: NavItem[] = [
  { label: 'Tienda', href: '/meliponas/tienda' },
  { label: 'Polinización', href: '/meliponas/polinizacion' },
  { label: 'Proyectos', href: '/meliponas/proyectos' },
  { label: 'I+D', href: '/meliponas/investigacion' },
  {
    label: 'Recursos',
    href: '/meliponas/bitacora',
    children: [
      { label: 'Bitácora', href: '/meliponas/bitacora' },
      { label: 'Quiénes Somos', href: '/meliponas/nosotros' },
      { label: 'Ayuda', href: '/meliponas/ayuda' },
      { label: 'Legal y Políticas', href: '/legal/' },
      { label: 'Contacto', href: '/meliponas/contacto' },
      { label: 'Modelador Técnico Financiero ↗', href: SIMULADOR_URL, external: true },
      { label: 'Intranet de Planeación ↗', href: INTRANET_URL, external: true },
    ],
  },
];

// Flat list (dropdown children inlined) — used by the Footer
export const NAV_FLAT_LINKS: NavChild[] = NAV_LINKS.flatMap((item) =>
  item.children ? item.children : [{ label: item.label, href: item.href as string }],
);

export const SEO = {
  // `SEO.home` es la portada del Meliponario, no la del ecosistema (la única llamada está en
  // `src/pages/meliponas/index.astro:141`). Se lee de la configuración de marca en vez de
  // reescribirse: eran dos copias literales del mismo título y la misma descripción, y la
  // descripción vive además en el JSON-LD de la organización, en el pie de marca y en la tarjeta
  // del hub — editarlas por separado garantiza que algún día digan cosas distintas.
  home: {
    title: meliponas.seo.defaultTitle,
    description: meliponas.seo.defaultDescription,
  },
  tienda: {
    title: 'Tienda Iwagé · Miel Angelita · Cajas INPA y AF · Kits meliponicultura',
    description:
      'Compra miel de Angelita con trazabilidad por colmena y cosecha. Cajas INPA y AF en Nogal Cafetero. Kits y asistencia técnica. Envío a Colombia.',
  },
  polinizacion: {
    title: 'Polinización gestionada de cultivos · Corredor Ambalá · Iwagé',
    description:
      'Servicio de polinización con Apis mellifera y meliponas para aguacate, café, mora y cítricos en el Tolima. Diagnóstico gratuito de predio.',
  },
  proyectos: {
    title: 'Diseño e Instalación de Meliponarios · Iwagé',
    description:
      'Diseño, instalación y acompañamiento de meliponarios a la medida para colegios (PRAE), fincas, centros turísticos y paisajismo en el Tolima.',
  },
  investigacion: {
    title: 'Investigación y Desarrollo en Meliponicultura · Iwagé',
    description:
      'Estándares de registro, automatización e IoT aplicados a la meliponicultura. Cajas, cadena de frío, jardines de néctar y perfilación de la miel por lote.',
  },
  trazabilidadMiel: {
    title: 'Estándar de Miel · Trazabilidad por lote y análisis · Iwagé',
    description:
      'Miel de Tetragonisca angustula con trazabilidad por lote, cadena de frío, análisis de laboratorio y QR de origen. Para consumidores, chefs y compradores B2B.',
  },
  trazabilidadCajas: {
    title: 'Estándar de Cajas · Identidad digital y monitoreo IoT · Iwagé',
    description:
      'Cajas INPA y AF en Nogal Cafetero con ID único, sensores IoT de temperatura y humedad, bitácora de colonia e historial transferible. Para meliponicultores.',
  },
  trazabilidadPolinizacion: {
    title: 'Estándar de Polinización · Servicio con resultados medibles · Iwagé',
    description:
      'Polinización gestionada con diagnóstico de predio, contrato, colonias certificadas, monitoreo en campo e informe de resultados. Para productores agrícolas.',
  },
  nosotros: {
    title: 'Nosotros · Historia y territorio · Iwagé Meliponario',
    description:
      'Un proyecto que nació de la observación del territorio, la identidad Pijao y el deseo de construir economía local sin extractivismo.',
  },
  contacto: {
    title: 'Contacto · Hablemos de tu proyecto · Iwagé',
    description:
      'Cuéntanos qué tienes en mente. Respondemos en menos de 24 horas por WhatsApp o en 48 horas por formulario.',
  },
} as const;
