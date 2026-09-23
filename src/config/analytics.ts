/**
 * Analytics & Verification Configuration
 * ─────────────────────────────────────────────────────────────────────
 * Migrado desde WordPress (tienda.iwage.co) — Jul 2026
 * Fuente: plugins Google Site Kit, Google Listings & Ads,
 *         Facebook for WooCommerce, Rank Math SEO
 * ─────────────────────────────────────────────────────────────────────
 */

// ─── Google ────────────────────────────────────────────────────────────
export const GOOGLE = {
  /** Search Console / Site Verification (meta tag) */
  siteVerification: 'KSQOspXch_CAM1dPpL3nuFSfvzmwdECLWeBm3dUaOzU',

  /** Google Tag (contenedor principal que carga GA4 + Ads) */
  tagId: 'GT-MB65XS23',
  tagAccountId: '6356227916',
  tagContainerId: '252936411',

  /** Google Analytics 4 */
  analytics: {
    accountId: '395214278',
    propertyId: '538344949',
    webDataStreamId: '14908263531',
    measurementId: 'G-QLHM81B7Q4',
  },

  /** Google Ads (conversiones) */
  ads: {
    accountId: '5507130397',
    accountOcid: '8253200149',
    conversionId: 'AW-18175748928',
    conversionLabel: 'MyUeCLPFlbAcEMDW79pD',
  },

  /** Google Merchant Center (Shopping) */
  merchantCenterId: '5791057335',

  /** Search Console property registrada */
  searchConsoleProperty: 'https://iwage.co/',
} as const;

// ─── Facebook / Meta ───────────────────────────────────────────────────
export const FACEBOOK = {
  /** Meta Pixel ID (tracking de conversiones) */
  pixelId: '1339630348088446',

  /** Business Manager */
  businessManagerId: '1661060241605819',

  /** Ad Account */
  adAccountId: '4334098790137578',

  /** Product Catalog (Facebook Shop) */
  productCatalogId: '4320918624903955',

  /** Instagram Business Profile */
  instagramBusinessId: '17841433789006373',

  /** Commerce Partner Integration */
  commercePartnerIntegrationId: '1265317178708220',

  /** External Business ID (WooCommerce) */
  externalBusinessId: 'tiendaiwage-6a0d2997a844f',
} as const;

// ─── SEO / Social Graph ────────────────────────────────────────────────
export const SOCIAL = {
  /** Tipo de entidad para Knowledge Graph */
  knowledgeGraphType: 'company',
  knowledgeGraphName: 'Iwagé',
  twitterCardType: 'summary_large_image',
} as const;

// ─── Swetrix (self-hosted) ─────────────────────────────────────────────
export const SWETRIX = {
  /** Project ID */
  projectId: '4RwWYkPcU082',
  /** Self-hosted API endpoint */
  apiURL: 'https://analitica.camilosaldarriaga.com/backend/v1/log',
  /** Script source */
  scriptSrc: 'https://swetrix.org/swetrix.js',
  /** Noscript fallback pixel */
  noscriptURL: 'https://analitica.camilosaldarriaga.com/backend/log/noscript?pid=4RwWYkPcU082',
} as const;

// ─── Flags de activación ───────────────────────────────────────────────
// Controlar qué scripts se inyectan en producción
export const ANALYTICS_ENABLED = {
  googleTag: import.meta.env.PROD,
  facebookPixel: import.meta.env.PROD,
  swetrix: import.meta.env.PROD,
} as const;
