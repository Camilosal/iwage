/** Metadatos de bitácora por marca. Los valores son los que ya usaba cada página; aquí pasan a haber uno solo. */
export interface BitacoraMarca {
  slug: string;
  nombre: string;
  autor: string;
  lugar: string;
  icono: string;
}

export const BITACORA_MARCAS: Record<string, BitacoraMarca> = {
  meliponas: {
    slug: 'meliponas',
    nombre: 'Iwagé Meliponario',
    autor: 'Equipo Iwagé Meliponario',
    lugar: 'Pijao, Quindío, Colombia',
    icono: 'hexagon',
  },
  cafe: {
    slug: 'cafe',
    nombre: 'Café Iwagé',
    autor: 'Equipo Café Iwagé',
    lugar: 'Pijao, Quindío, Colombia',
    icono: 'coffee',
  },
  granja: {
    slug: 'granja',
    nombre: 'Iwagé Granja',
    autor: 'Manuel Camilo Saldarriaga Acosta',
    lugar: 'Corredor Ambalá, Ibagué, Tolima',
    icono: 'leaf',
  },
  tierras: {
    slug: 'tierras',
    nombre: 'Iwagé Tierras',
    autor: 'Equipo Iwagé Tierras',
    lugar: 'Ibagué, Tolima, Colombia',
    icono: 'sunrise',
  },
  naturaleza: {
    slug: 'naturaleza',
    nombre: 'Iwagé Naturaleza',
    autor: 'Equipo Iwagé Naturaleza',
    lugar: 'Quindío, Colombia',
    icono: 'leaf',
  },
  gestion: {
    slug: 'gestion',
    nombre: 'Iwagé Gestión',
    autor: 'Equipo Iwagé Gestión',
    lugar: 'Ibagué, Tolima, Colombia',
    icono: 'building-2',
  },
};
