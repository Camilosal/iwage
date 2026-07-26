/**
 * Configuración centralizada de las Herramientas del Meliponario.
 *
 * Tres pilares:
 *  1. Trazabilidad  — páginas internas del sitio (/meliponas/trazabilidad/*)
 *  2. Modelador Pro — app externa (simulacion.iwage.co)
 *  3. Intranet      — sistema de planeación externo (intranet.iwage.co)
 */

export const SIMULADOR_URL = 'https://simulacion.iwage.co';
export const INTRANET_URL = 'https://intranet.iwage.co';

export interface IntranetDoc {
  /** Nombre de archivo exacto en la raíz de la intranet (con espacios) */
  file: string;
  /** Título legible */
  title: string;
  /** Descripción corta */
  desc: string;
}

export interface IntranetCategory {
  id: string;
  label: string;
  icon: string;
  docs: IntranetDoc[];
}

/** Documentos de la intranet organizados por categoría funcional. */
export const INTRANET_CATEGORIES: IntranetCategory[] = [
  {
    id: 'estrategia',
    label: 'Estrategia & Modelo',
    icon: '🧭',
    docs: [
      {
        file: '0. matriz_integral_del_ecosistema.html',
        title: 'Matriz Integral del Ecosistema',
        desc: 'Visión global de las 5 marcas, sus audiencias y relaciones.',
      },
      {
        file: '1. manual_del_ecosistema.html',
        title: 'Manual del Ecosistema',
        desc: 'Identidad, tono de voz y lineamientos de marca Iwagé.',
      },
      {
        file: '2. Canvas y Modelo Financiero.html',
        title: 'Canvas & Modelo Financiero',
        desc: 'Business Model Canvas y estructura financiera del ecosistema.',
      },
    ],
  },
  {
    id: 'audiencias',
    label: 'Audiencias & Marketing',
    icon: '🎯',
    docs: [
      {
        file: '3. Sistema_de_audiencias.html',
        title: 'Sistema de Audiencias',
        desc: 'Segmentación, perfiles y necesidades por tipo de cliente.',
      },
      {
        file: '5. flujo_de_marketing.html',
        title: 'Flujo de Marketing',
        desc: 'Embudos, canales y automatización de captación.',
      },
    ],
  },
  {
    id: 'operaciones',
    label: 'Operaciones',
    icon: '⚙️',
    docs: [
      {
        file: '4. Sistema_operativo_y_pipelines.html',
        title: 'Sistema Operativo & Pipelines',
        desc: 'Pipelines de Zoho CRM y flujo operativo comercial.',
      },
      {
        file: '6. libro_de_operaciones.html',
        title: 'Libro de Operaciones',
        desc: 'Procesos diarios, protocolos y estándares operativos.',
      },
    ],
  },
  {
    id: 'trazabilidad',
    label: 'Trazabilidad',
    icon: '🔬',
    docs: [
      {
        file: '7. Protocolo_de_trazabilidad.html',
        title: 'Protocolo de Trazabilidad',
        desc: 'Estándar técnico de trazabilidad de miel, cajas y polinización.',
      },
    ],
  },
];

/** Landings comerciales disponibles en la intranet. */
export const INTRANET_LANDINGS: IntranetDoc[] = [
  { file: 'agro_polinización.html', title: 'Agro · Polinización', desc: 'Servicio de polinización para cultivos.' },
  { file: 'b2b_alianzas.html', title: 'B2B · Alianzas', desc: 'Programa de alianzas corporativas.' },
  { file: 'b2b_alta_cocina.html', title: 'B2B · Alta Cocina', desc: 'Miel trazada para restaurantes.' },
  { file: 'b2c_bienestar.html', title: 'B2C · Bienestar', desc: 'Línea de bienestar y consumo.' },
  { file: 'colegios_prae.html', title: 'Colegios · PRAE', desc: 'Programa ambiental escolar.' },
  { file: 'especie_qr.html', title: 'Especie · QR', desc: 'Trazabilidad por código QR.' },
  { file: 'residencial_paisajismo.html', title: 'Residencial · Paisajismo', desc: 'Soluciones de paisajismo.' },
];

/** Construye la URL pública de un documento de la intranet (con encoding). */
export function intranetUrl(file: string): string {
  return `${INTRANET_URL}/${encodeURIComponent(file)}`;
}
