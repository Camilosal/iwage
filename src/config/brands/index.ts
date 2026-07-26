import type { BrandConfig } from './types';
import { meliponas } from './meliponas';
import { cafe } from './cafe';
import { tierras } from './tierras';
import { naturaleza } from './naturaleza';
import { gestion } from './gestion';

export type { BrandConfig, BrandColors, BrandFonts, BrandNavItem, BrandSEO } from './types';

/** All registered brands */
export const brands: Record<string, BrandConfig> = {
  meliponas,
  cafe,
  tierras,
  naturaleza,
  gestion,
};

/** Ordered list for ecosystem hub display */
export const brandList: BrandConfig[] = [
  meliponas,
  cafe,
  tierras,
  naturaleza,
  gestion,
];

/** Get brand config by slug */
export function getBrand(slug: string): BrandConfig | undefined {
  return brands[slug];
}

/** Detect brand from URL pathname (e.g., '/tierras/propiedades' → tierras) */
export function getBrandFromPath(pathname: string): BrandConfig | undefined {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return undefined;
  const firstSegment = segments[0];
  return brands[firstSegment];
}

/** Get the default brand (meliponas) for legacy routes */
export const defaultBrand = meliponas;
