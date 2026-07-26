import type { BrandConfig } from './types';

export const gestion: BrandConfig = {
  slug: 'gestion',
  name: 'Iwagé Gestión',
  tagline: 'Property Management & Operación Inmobiliaria',
  colors: {
    brand: '#1e3a5f',
    brandLight: '#2d5a8f',
    brandDark: '#122640',
    accent: '#52B788',
    accentLight: '#7fc4a2',
    surface: '#f8f9fb',
    darkBg: '#0c1520',
  },
  fonts: {
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  nav: [
    { label: 'Propiedades', href: '/gestion/propiedades' },
    { label: 'Alianzas', href: '/gestion/modelo-alianzas' },
    {
      label: 'Comunidad',
      href: '/gestion/bitacora',
      children: [
        { label: 'Bitácora', href: '/gestion/bitacora' },
        { label: 'Ayuda', href: '/gestion/ayuda' },
        { label: 'Contacto', href: '/gestion/contacto' },
      ],
    },
  ],
  seo: {
    defaultTitle: 'Iwagé Gestión · Property Management Rural · Tolima',
    defaultDescription:
      'Gestión integral de propiedades rurales: renta corta, finca productiva, segunda residencia y operación turística. Maximiza el valor de tu tierra.',
  },
  whatsapp: '573001234567',
  instagram: '@iwage.gestion',
  icon: '🏗️',
};
