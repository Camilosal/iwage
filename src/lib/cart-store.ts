/**
 * cart-store.ts
 * Carrito unificado multi-marca, framework-agnostic y persistido en localStorage.
 *
 * Cada mutación dispara `window.dispatchEvent(new CustomEvent('iwage:cart-updated'))`
 * para que cualquier isla (UnifiedCart, botones "agregar") se sincronice.
 */

export interface CartItem {
  /** Clave única: recurso_slug + disponibilidad_id (si aplica) */
  key: string;
  recurso_slug: string;
  nombre: string;
  /** Precio unitario (0 para items gratuitos) */
  precio: number;
  cantidad: number;
  /** tipo del recurso (producto, experiencia, pedido_cafe, propiedad_estancia, ...) */
  tipo: string;
  /** tipo_disponibilidad del recurso (inmediato, slot_horario, fecha_completa, ...) */
  tipo_disponibilidad: string;
  /** Marca de origen para agrupar en el drawer (meliponas, cafe, naturaleza, ...) */
  brand: string;
  /** origen del recurso en el catálogo (iwage_meliponas, iwage_cafe, ...) */
  origen: string;
  requiere_pago: boolean;
  /** documentId del slot elegido (solo items agendables) */
  disponibilidad_id?: string;
  /** Etiqueta legible del slot (fecha y hora) para mostrar en el carrito */
  disponibilidad_label?: string;
  /** URL pública del producto/página de origen */
  url?: string;
}

const STORAGE_KEY = 'iwage_cart_v1';
export const CART_EVENT = 'iwage:cart-updated';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function makeKey(recursoSlug: string, disponibilidadId?: string): string {
  return disponibilidadId ? `${recursoSlug}::${disponibilidadId}` : recursoSlug;
}

function notify(): void {
  if (isBrowser()) {
    window.dispatchEvent(new CustomEvent(CART_EVENT));
  }
}

export function getCart(): CartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

function persist(items: CartItem[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore quota / serialization errors
  }
  notify();
}

/**
 * Agrega un item al carrito. Si ya existe uno con el mismo recurso_slug + disponibilidad_id,
 * suma la cantidad (merge). Dispara el evento de actualización.
 */
export function addItem(item: Omit<CartItem, 'key'> & { key?: string }): CartItem[] {
  const items = getCart();
  const key = item.key || makeKey(item.recurso_slug, item.disponibilidad_id);
  const existing = items.find((i) => i.key === key);

  if (existing) {
    existing.cantidad += item.cantidad || 1;
  } else {
    items.push({ ...item, key, cantidad: item.cantidad || 1 });
  }

  persist(items);
  return items;
}

export function removeItem(key: string): CartItem[] {
  const items = getCart().filter((i) => i.key !== key);
  persist(items);
  return items;
}

export function updateCantidad(key: string, cantidad: number): CartItem[] {
  const items = getCart();
  const item = items.find((i) => i.key === key);
  if (item) {
    if (cantidad <= 0) {
      return removeItem(key);
    }
    item.cantidad = cantidad;
    persist(items);
  }
  return items;
}

export function clearCart(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  notify();
}

/** Total acumulado considerando solo los items que requieren pago. */
export function getTotal(items: CartItem[] = getCart()): number {
  return items.reduce((sum, i) => (i.requiere_pago ? sum + i.precio * i.cantidad : sum), 0);
}

/** Cantidad total de líneas en el carrito. */
export function getCount(items: CartItem[] = getCart()): number {
  return items.reduce((sum, i) => sum + i.cantidad, 0);
}

export function formatCOP(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}
