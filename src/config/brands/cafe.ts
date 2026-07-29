import type { BrandConfig } from './types';

export const cafe: BrandConfig = {
  slug: 'cafe',
  name: 'Café Iwagé',
  tagline: 'El territorio en cada taza',
  colors: {
    brand: '#5c3d2e',
    brandLight: '#7a5540',
    brandDark: '#3e2a1f',
    accent: '#c8933e',
    accentLight: '#e8b96a',
    surface: '#fdf9f3',
    darkBg: '#1a120d',
  },
  fonts: {
    sans: "'Inter', system-ui, sans-serif",
    display: "'Playfair Display', Georgia, serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  nav: [
    { label: 'Menú', href: '/cafe/menu' },
    { label: 'Recetas', href: '/cafe/recetas' },
    { label: 'Proveedores', href: '/cafe/proveedores' },
    {
      label: 'Recursos',
      href: '/cafe/bitacora',
      children: [
        { label: 'Nosotros', href: '/cafe/nosotros' },
        { label: 'Bitácora', href: '/cafe/bitacora' },
        { label: 'Ayuda', href: '/cafe/ayuda' },
        { label: 'Contacto', href: '/cafe/contacto' },
      ],
    },
  ],
  seo: {
    defaultTitle: 'Café Iwagé · El territorio en cada taza',
    defaultDescription:
      'Un café comunitario construido sobre ingredientes nombrados, proveedores a menos de 4km y un menú donde cada producto es un personaje.',
  },
  whatsapp: '573001234567',
  instagram: '@cafe.iwage',
  icon: 'coffee',
};
