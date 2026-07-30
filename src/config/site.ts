import { SIMULADOR_URL, INTRANET_URL } from './tools';
export const SITE = {
  name: 'Iwagé',
  tagline: 'Meliponario & Biotecnología Nativa',
  url: process.env.APP_URL || 'https://iwage.co',
  description:
    'Centro de meliponicultura en Ibagué, Tolima. Miel de Angelita pura, cajas tecnificadas INPA/AF, proyectos de impacto y polinización asistida.',
  whatsapp: '+573026693366',
  email: 'hola@iwage.co',
  instagram: '@iwage.meliponario',
  location: 'Corredor Ambalá, Ibagué, Tolima',
} as const;

export type NavChild = { label: string; href: string; external?: boolean };
export type NavItem = { label: string; href?: string; children?: NavChild[] };

export const NAV_LINKS: NavItem[] = [
  { label: 'Tienda', href: '/meliponas/tienda' },
  { label: 'Polinización', href: '/meliponas/polinizacion' },
  { label: 'Proyectos', href: '/meliponas/proyectos' },
  {
    label: 'Herramientas',
    href: '/meliponas/herramientas',
    children: [
      { label: 'Panel de Herramientas', href: '/meliponas/herramientas' },
      { label: 'Trazabilidad', href: '/meliponas/trazabilidad' },
      { label: 'Modelador Técnico Financiero ↗', href: SIMULADOR_URL, external: true },
      { label: 'Intranet de Planeación', href: INTRANET_URL, external: true },
    ],
  },
  {
    label: 'Recursos',
    href: '/meliponas/bitacora',
    children: [
      { label: 'Bitácora', href: '/meliponas/bitacora' },
      { label: 'Quiénes Somos', href: '/meliponas/nosotros' },
      { label: 'Ayuda', href: '/ayuda/' },
      { label: 'Legal y Políticas', href: '/legal/' },
      { label: 'Contacto', href: '/meliponas/contacto' },
    ],
  },
];

// Flat list (dropdown children inlined) — used by the Footer
export const NAV_FLAT_LINKS: NavChild[] = NAV_LINKS.flatMap((item) =>
  item.children ? item.children : [{ label: item.label, href: item.href as string }],
);

export const SEO = {
  home: {
    title: 'Iwagé Meliponario · Miel Angelita y cajas para meliponas · Ibagué, Tolima',
    description:
      'Miel de Tetragonisca angustula del corredor Ambalá. Cajas INPA y AF en Nogal Cafetero. Polinización gestionada y asistencia técnica en Ibagué, Tolima.',
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
  trazabilidad: {
    title: 'Trazabilidad Iwagé · Estándares de Miel, Cajas IoT y Polinización',
    description:
      'Tres estándares verificables: miel con trazabilidad por lote y análisis de laboratorio, cajas INPA/AF con monitoreo IoT, y polinización gestionada con resultados medibles.',
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
  herramientas: {
    title: 'Herramientas del Meliponario · Trazabilidad, Modelador Pro e Intranet · Iwagé',
    description:
      'Panel de herramientas del meliponario Iwagé: sistema de trazabilidad (miel, cajas IoT y polinización), Modelador Técnico Financiero ↗ y la Intranet de planeación del ecosistema.',
  },
  bitacora: {
    title: 'Bitácora del Meliponario · Conocimiento abierto · Iwagé',
    description:
      'Guías técnicas, flora nativa, territorio Pijao y producción agroecológica desde el piedemonte tolimense.',
  },
  nosotros: {
    title: 'Nosotros · Historia y territorio · Iwagé Meliponario',
    description:
      'Un proyecto que nació de la observación del territorio, la identidad Pijao y el deseo de construir economía local sin extractivismo.',
  },
  cafe: {
    title: 'Café Iwagé · El territorio en cada taza',
    description:
      'Un café comunitario construido sobre ingredientes nombrados, proveedores a menos de 4km y un menú donde cada producto es un personaje.',
  },
  contacto: {
    title: 'Contacto · Hablemos de tu proyecto · Iwagé',
    description:
      'Cuéntanos qué tienes en mente. Respondemos en menos de 24 horas por WhatsApp o en 48 horas por formulario.',
  },
} as const;
