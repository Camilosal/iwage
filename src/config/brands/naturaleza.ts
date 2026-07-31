import type { BrandConfig } from './types';

export const naturaleza: BrandConfig = {
  slug: 'naturaleza',
  name: 'Iwagé Naturaleza',
  tagline: 'Turismo Regenerativo & Experiencias de Territorio',
  colors: {
    brand: '#2d5016',
    brandLight: '#4a7c23',
    brandDark: '#1a3009',
    accent: '#d4920a',
    accentLight: '#f5c842',
    surface: '#f8faf5',
    darkBg: '#0e1a08',
  },
  fonts: {
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  nav: [
    {
      label: 'Experiencias',
      href: '/naturaleza/experiencias',
      children: [
        { label: 'Catálogo de Experiencias', href: '/naturaleza/experiencias' },
        { label: 'Programas & Paquetes', href: '/naturaleza/programas' },
        { label: 'Clasificación', href: '/naturaleza/clasificacion' },
      ],
    },
    {
      label: 'Anfitriones',
      href: '/naturaleza/anfitriones',
      children: [
        { label: 'Directorio', href: '/naturaleza/anfitriones' },
        { label: 'Escalafón', href: '/naturaleza/escalafon' },
        { label: 'Hub de Recursos', href: '/naturaleza/anfitriones/hub' },
      ],
    },
    { label: 'Sé Anfitrión', href: '/naturaleza/se-anfitrion' },
    { label: 'Impacto', href: '/naturaleza/impacto' },
    {
      label: 'Recursos',
      href: '/naturaleza/bitacora',
      children: [
        { label: 'Nosotros', href: '/naturaleza/nosotros' },
        { label: 'Bitácora', href: '/naturaleza/bitacora' },
        { label: 'Ayuda', href: '/naturaleza/ayuda' },
        { label: 'Legal y Políticas', href: '/legal/' },
        { label: 'Contacto', href: '/naturaleza/contacto' },
      ],
    },
  ],
  seo: {
    defaultTitle: 'Iwagé Naturaleza · Turismo Regenerativo · Tolima',
    defaultDescription:
      'Experiencias de turismo regenerativo guiadas por anfitriones locales en el corredor Ambalá, Tolima. Avistamiento, senderismo y conexión con el territorio.',
  },
  whatsapp: '573026693366',
  instagram: '@iwage.naturaleza',
  icon: 'leaf',
};
