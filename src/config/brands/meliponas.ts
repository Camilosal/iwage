import type { BrandConfig } from './types';
import { SIMULADOR_URL, INTRANET_URL } from '../tools';

export const meliponas: BrandConfig = {
  slug: 'meliponas',
  name: 'Iwagé Meliponario',
  tagline: 'Meliponario & Biotecnología Nativa',
  colors: {
    brand: '#2d4a3e',
    brandLight: '#3d6354',
    brandDark: '#1e332b',
    accent: '#d4920a',
    accentLight: '#f5c842',
    surface: '#fafaf8',
    darkBg: '#16211c',
  },
  fonts: {
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  nav: [
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
        { label: 'Ayuda', href: '/meliponas/ayuda' },
        { label: 'Legal y Políticas', href: '/legal/' },
        { label: 'Contacto', href: '/meliponas/contacto' },
      ],
    },
  ],
  seo: {
    defaultTitle: 'Iwagé Meliponario · Miel Angelita y cajas para meliponas · Ibagué, Tolima',
    defaultDescription:
      'Miel de Tetragonisca angustula del corredor Ambalá. Cajas INPA y AF en Nogal Cafetero. Polinización gestionada y asistencia técnica en Ibagué, Tolima.',
  },
  whatsapp: '573026693366',
  instagram: '@iwage.meliponario',
  icon: 'hexagon',
};
