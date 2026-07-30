import type { BrandConfig } from './types';

export const gestion: BrandConfig = {
  slug: 'gestion',
  name: 'Iwagé Gestión',
  tagline: 'Alojamientos rurales & Gestión de propiedades',
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
    { label: 'Alojamientos', href: '/gestion/alojamientos' },
    { label: 'Experiencias', href: '/gestion/experiencias' },
    {
      label: 'Propietarios',
      href: '/gestion/propietarios',
      children: [
        { label: 'Modelo de Alianzas', href: '/gestion/propietarios/modelo-alianzas' },
        { label: 'Renta Corta', href: '/gestion/propietarios/renta-corta' },
        { label: 'Finca Productiva', href: '/gestion/propietarios/finca-productiva' },
        { label: 'Segunda Residencia', href: '/gestion/propietarios/segunda-residencia' },
        { label: 'Operación Turística', href: '/gestion/propietarios/operacion-turistica' },
      ],
    },
    {
      label: 'Recursos',
      href: '/gestion/bitacora',
      children: [
        { label: 'Bitácora', href: '/gestion/bitacora' },
        { label: 'Ayuda', href: '/gestion/ayuda' },
        { label: 'Legal y Políticas', href: '/legal/' },
        { label: 'Contacto', href: '/gestion/contacto' },
      ],
    },
  ],
  seo: {
    defaultTitle: 'Iwagé Gestión · Alojamientos Rurales & Property Management · Tolima',
    defaultDescription:
      'Reserva alojamientos rurales únicos en el Tolima y gestiona tu propiedad con expertos. Fincas, glamping, casas campestres y experiencias de territorio.',
  },
  whatsapp: '573026693366',
  instagram: '@iwage.gestion',
  icon: 'building-2',
};
