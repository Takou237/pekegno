import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface CartItem {
  key: string;
  type: 'service' | 'product';
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  slug?: string;
  coverImage?: string | null;
  agencyName?: string;
  categoryName?: string;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, 'key' | 'quantity'> & { quantity?: number }) => void;
  updateQuantity: (key: string, quantity: number) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

const STORAGE_KEY = 'pekegno_cart';
const MAX_QTY = 99;

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Stockage indisponible (navigation privée) : le panier reste en mémoire.
    }
  }, []);

  const addItem = useCallback(
    (item: Omit<CartItem, 'key' | 'quantity'> & { quantity?: number }) => {
      const key = `${item.type}:${item.id}`;
      const qty = Math.max(1, item.quantity ?? 1);
      const existing = items.find((i) => i.key === key);

      const next = existing
        ? items.map((i) =>
            i.key === key ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + qty) } : i,
          )
        : [...items, { ...item, key, quantity: Math.min(MAX_QTY, qty) }];

      persist(next);
    },
    [items, persist],
  );

  const updateQuantity = useCallback(
    (key: string, quantity: number) => {
      const qty = Math.max(1, Math.min(MAX_QTY, quantity));
      persist(items.map((i) => (i.key === key ? { ...i, quantity: qty } : i)));
    },
    [items, persist],
  );

  const removeItem = useCallback(
    (key: string) => {
      persist(items.filter((i) => i.key !== key));
    },
    [items, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    return { items, count, subtotal, addItem, updateQuantity, removeItem, clear };
  }, [items, addItem, updateQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}