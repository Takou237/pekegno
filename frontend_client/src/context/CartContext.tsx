import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clientApi } from '@/api/client.api';
import { useAuth } from '@/context/AuthContext';
import type { Cart as ServerCart } from '@/types';

export interface CartItem {
  key: string;
  cartItemId?: string;
  type: 'service' | 'product';
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  slug?: string | null;
  coverImage?: string | null;
  agencyName?: string;
  categoryName?: string | null;
  available?: boolean;
  reason?: string | null;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotal: number;
  isSyncing: boolean;
  addItem: (item: Omit<CartItem, 'key' | 'quantity'> & { quantity?: number }) => Promise<void>;
  updateQuantity: (key: string, quantity: number) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

const STORAGE_KEY = 'pekegno_cart';
const MAX_QTY = 99;

const CartContext = createContext<CartContextValue | null>(null);

function persistLocal(owner: string | null, items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ owner, items }));
  } catch {
    // Stockage indisponible (navigation privée) : le panier reste en mémoire.
  }
}

function loadLocal(owner: string | null): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { owner: string | null; items?: CartItem[] };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    if (owner === null || parsed.owner === null || parsed.owner === owner) {
      return items;
    }
    return [];
  } catch {
    return [];
  }
}

function fromServerCart(cart: ServerCart): CartItem[] {
  return (cart.items ?? []).map((item) => {
    const catalogId = item.service_id ?? item.product_id ?? item.id;
    return {
      key: `${item.type}:${catalogId}`,
      cartItemId: item.id,
      type: item.type === 'product' ? 'product' : 'service',
      id: catalogId,
      name: item.name,
      unitPrice: item.effective_price,
      quantity: item.quantity,
      slug: item.slug ?? undefined,
      coverImage: item.cover_image,
      categoryName: item.category_name,
      available: item.available,
      reason: item.reason ?? null,
    };
  });
}

function toServerPayload(items: CartItem[]): { items: { service_id?: string; product_id?: string; quantity: number }[] } {
  return {
    items: items.map((i) => ({
      service_id: i.type === 'service' ? i.id : undefined,
      product_id: i.type === 'product' ? i.id : undefined,
      quantity: i.quantity,
    })),
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id ?? null;
  const [items, setItems] = useState<CartItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncedOnce = useRef(false);
  const itemsRef = useRef<CartItem[]>([]);
  itemsRef.current = items;

  const persist = useCallback(
    (next: CartItem[]) => {
      setItems(next);
      persistLocal(userId, next);
    },
    [userId],
  );

  const adoptServer = useCallback(
    (cart: ServerCart) => {
      const converted = fromServerCart(cart);
      setItems(converted);
      persistLocal(userId, converted);
    },
    [userId],
  );

  const syncWithServer = useCallback(async () => {
    if (!isAuthenticated || !userId) return;
    setIsSyncing(true);
    try {
      const server = await clientApi.getCart();
      if ((server.items ?? []).length > 0) {
        adoptServer(server);
      } else {
        const local = loadLocal(userId);
        if (local.length > 0) {
          try {
            const merged = await clientApi.syncCart(toServerPayload(local));
            adoptServer(merged);
          } catch {
            adoptServer(server);
          }
        } else {
          adoptServer(server);
        }
      }
    } catch {
      const local = loadLocal(userId);
      if (local.length > 0) {
        setItems(local);
        persistLocal(userId, local);
      }
    } finally {
      setIsSyncing(false);
      syncedOnce.current = true;
    }
  }, [isAuthenticated, userId, adoptServer]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      syncWithServer();
    } else if (!isAuthenticated) {
      const local = loadLocal(null);
      setItems(local);
      syncedOnce.current = false;
    }
  }, [isAuthenticated, userId, syncWithServer]);

  const addItem = useCallback(
    async (item: Omit<CartItem, 'key' | 'quantity'> & { quantity?: number }) => {
      const current = itemsRef.current;
      const key = `${item.type}:${item.id}`;
      const qty = Math.max(1, item.quantity ?? 1);
      const existing = current.find((i) => i.key === key);

      if (isAuthenticated && userId) {
        const payload =
          item.type === 'service'
            ? { service_id: item.id, quantity: qty }
            : { product_id: item.id, quantity: qty };
        try {
          const server = await clientApi.addToCart(payload);
          adoptServer(server);
          return;
        } catch {
          // API indisponible : fallback local pour ne pas bloquer l'ajout.
        }
      }

      const next = existing
        ? current.map((i) =>
            i.key === key ? { ...i, quantity: Math.min(MAX_QTY, i.quantity + qty) } : i,
          )
        : [...current, { ...item, key, quantity: Math.min(MAX_QTY, qty) }];
      persist(next);
    },
    [isAuthenticated, userId, persist, adoptServer],
  );

  const updateQuantity = useCallback(
    async (key: string, quantity: number) => {
      const current = itemsRef.current;
      const qty = Math.max(1, Math.min(MAX_QTY, quantity));
      const target = current.find((i) => i.key === key);

      if (isAuthenticated && userId && target?.cartItemId) {
        try {
          const server = await clientApi.updateCartItem(target.cartItemId, qty);
          adoptServer(server);
          return;
        } catch {
          // Fallback local.
        }
      }

      persist(current.map((i) => (i.key === key ? { ...i, quantity: qty } : i)));
    },
    [isAuthenticated, userId, persist, adoptServer],
  );

  const removeItem = useCallback(
    async (key: string) => {
      const current = itemsRef.current;
      const target = current.find((i) => i.key === key);

      if (isAuthenticated && userId && target?.cartItemId) {
        try {
          const server = await clientApi.removeCartItem(target.cartItemId);
          adoptServer(server);
          return;
        } catch {
          // Fallback local.
        }
      }

      persist(current.filter((i) => i.key !== key));
    },
    [isAuthenticated, userId, persist, adoptServer],
  );

  const clear = useCallback(async () => {
    if (isAuthenticated && userId) {
      try {
        const server = await clientApi.clearCart();
        adoptServer(server);
        return;
      } catch {
        // Fallback local.
      }
    }
    persist([]);
  }, [isAuthenticated, userId, persist, adoptServer]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
    return { items, count, subtotal, isSyncing, addItem, updateQuantity, removeItem, clear };
  }, [items, isSyncing, addItem, updateQuantity, removeItem, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}