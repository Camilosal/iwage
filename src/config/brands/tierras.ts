import type { BrandConfig } from './types';

export const tierras: BrandConfig = {
  slug: 'tierras',
  name: 'Iwagé Tierras',
  tagline: 'Inmobiliaria Rural con Conocimiento Territorial',
  colors: {
    brand: '#1B4332',
    brandLight: '#52B788',
    brandDark: '#0f2b20',
    accent: '#C8933E',
    accentLight: '#E8B96A',
    surface: '#FAFAF7',
    darkBg: '#0F120E',
  },
  fonts: {
    sans: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
  },
  nav: [
    {
      label: 'Comprar',
      href: '/tierras/propiedades',
      children: [
        { label: 'Catálogo de Propiedades', href: '/tierras/propiedades' },
        { label: 'Usos del Predio', href: '/tierras/perfiles' },
        { label: 'Guía de Compra', href: '/tierras/comprar' },
      ],
    },
    { label: 'Vender', href: '/tierras/vender' },
    { label: 'Protocolo VAP', href: '/tierras/protocolo-vap' },
    {
      label: 'Herramientas',
      href: '/tierras/lab',
      children: [
        { label: 'Iwagé Lab', href: '/tierras/lab' },
        { label: 'Calculadora Notarial', href: '/tierras/herramientas/calculadora-notarial' },
        { label: 'ROI Calculator', href: '/tierras/herramientas/roi-calculator' },
        { label: 'Evaluación VAP', href: '/tierras/herramientas/evaluacion-vap' },
      ],
    },
    {
      label: 'Recursos',
      href: '/tierras/bitacora',
      children: [
        { label: 'Bitácora', href: '/tierras/bitacora' },
        { label: 'Nosotros', href: '/tierras/nosotros' },
        { label: 'Ayuda', href: '/tierras/ayuda' },
        { label: 'Contacto', href: '/tierras/contacto' },
      ],
    },
  ],
  seo: {
    defaultTitle: 'Iwagé Tierras · Inmobiliaria Rural · Tolima, Colombia',
    defaultDescription:
      'Propiedades rurales con verificación técnica, conocimiento territorial y valoración algorítmica en el Tolima. Fincas productivas, campestres y turísticas.',
  },
  whatsapp: '573001234567',
  instagram: '@iwage.tierras',
  icon: 'mountain',
};
