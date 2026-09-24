import type { BrandConfig } from './types';

export const granja: BrandConfig = {
  slug: 'granja',
  name: 'Granja',
  tagline: 'Agroecosistema & Laboratorio Vivo',
  colors: {
    brand: '#5b4a2f',
    brandLight: '#7a6340',
    brandDark: '#3e321f',
    accent: '#c06b2f',
    accentLight: '#e69551',
    surface: '#faf9f6',
    darkBg: '#211c14',
  },
  fonts: {
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  nav: [
    {
      label: 'El sistema',
      href: '/granja/sistema',
      children: [
        { label: 'Subsistemas', href: '/granja/sistema' },
        { label: 'Experimentos', href: '/granja/experimentos' },
      ],
    },
    { label: 'Visitas', href: '/granja/visitas' },
    { label: 'Servicios', href: '/granja/servicios' },
    { label: 'Tienda', href: '/granja/tienda' },
    {
      label: 'Recursos',
      href: '/granja/bitacora',
      children: [
        { label: 'Bitácora', href: '/granja/bitacora' },
        { label: 'Quiénes Somos', href: '/granja/nosotros' },
        { label: 'Ayuda', href: '/granja/ayuda' },
        { label: 'Contacto', href: '/granja/contacto' },
      ],
    },
  ],
  seo: {
    defaultTitle: 'Iwagé Granja · Sistema autosustentable peri-urbano · Ibagué, Tolima',
    defaultDescription:
      'Granja autosustentable peri-urbana en construcción: agroecosistema, bio-refinería doméstica, gestión hídrica, solar off-grid y gemelo digital. Documentado subsistema por subsistema desde Ambalá, Ibagué.',
  },
  whatsapp: '573026693366',
  instagram: '@iwage.co',
  icon: 'sprout',
};
