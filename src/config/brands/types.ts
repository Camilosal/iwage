export interface BrandColors {
  brand: string;
  brandLight: string;
  brandDark: string;
  accent: string;
  accentLight: string;
  surface: string;
  darkBg: string;
}

export interface BrandFonts {
  sans: string;
  display?: string;
  mono?: string;
}

export interface BrandNavItem {
  label: string;
  href: string;
  /** Optional submenu items (max 5 top-level items enforced per brand) */
  children?: BrandNavItem[];
  /** External link — opens in a new tab with rel=noopener */
  external?: boolean;
}

export interface BrandSEO {
  defaultTitle: string;
  defaultDescription: string;
}

export interface BrandConfig {
  /** URL prefix (e.g., 'meliponas', 'cafe', 'tierras') */
  slug: string;
  /** Display name */
  name: string;
  /** Short tagline shown in navbar/footer */
  tagline: string;
  /** Brand color palette */
  colors: BrandColors;
  /** Font families */
  fonts: BrandFonts;
  /** Navigation links for this brand (max 5 top-level items) */
  nav: BrandNavItem[];
  /** Default SEO metadata */
  seo: BrandSEO;
  /** WhatsApp number (E.164 format without +) */
  whatsapp?: string;
  /** Instagram handle */
  instagram?: string;
  /** Lucide icon name for the brand */
  icon?: string;
}
