import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CartModifierSnapshot {
  modifierGroupId: string;
  modifierGroupName: string;
  optionIds: string[];
  optionNames: string[];
  totalPriceDelta: number;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string | null;
  variantName?: string | null;
  quantity: number;
  notes?: string;
  basePrice: number;
  unitPrice: number;
  lineTotal: number;
  modifierSelections: CartModifierSnapshot[];
}

interface CartContextValue {
  contextKey: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  setContext: (nextContextKey: string) => void;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (itemId: string) => void;
  clear: () => void;
}

const CART_STORAGE_KEY = 'roi_qr_cart';
const CART_CONTEXT_STORAGE_KEY = 'roi_qr_cart_context';

const CartContext = createContext<CartContextValue | undefined>(undefined);

function loadStoredItems(): CartItem[] {
  if (typeof window === 'undefined') return [];
  const raw = window.sessionStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredItems(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

function loadStoredContext(): string {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(CART_CONTEXT_STORAGE_KEY) ?? '';
}

function saveStoredContext(value: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(CART_CONTEXT_STORAGE_KEY, value);
}

function createId() {
  return `cart-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [contextKey, setContextKey] = useState(loadStoredContext());
  const [items, setItems] = useState<CartItem[]>(loadStoredItems());

  const setContext = (nextContextKey: string) => {
    setContextKey((current) => {
      if (current === nextContextKey) {
        return current;
      }

      setItems([]);
      saveStoredItems([]);
      saveStoredContext(nextContextKey);
      return nextContextKey;
    });
  };

  const addItem = (item: Omit<CartItem, 'id'>) => {
    setItems((prev) => {
      const next = [...prev, { ...item, id: createId() }];
      saveStoredItems(next);
      return next;
    });
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== itemId);
      saveStoredItems(next);
      return next;
    });
  };

  const clear = () => {
    setItems([]);
    saveStoredItems([]);
  };

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((acc, item) => acc + item.quantity, 0);
    const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
    return {
      contextKey,
      items,
      itemCount,
      subtotal,
      setContext,
      addItem,
      removeItem,
      clear,
    };
  }, [contextKey, items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('Cart context is unavailable');
  }
  return context;
}
