'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type CartItem = { productId: string; name: string; price: number; image?: string; quantity: number; stock: number };
type CartContextValue = { items: CartItem[]; add: (item: CartItem) => void; setQuantity: (productId: string, quantity: number) => void; remove: (productId: string) => void; clear: () => void; count: number; subtotal: number };
const CartContext = createContext<CartContextValue | null>(null);
const KEY = 'zenvora-cart-v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => { try { const raw = localStorage.getItem(KEY); if (raw) setItems(JSON.parse(raw)); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }, [items]);
  const value = useMemo(() => ({
    items,
    add: (item: CartItem) => setItems(current => { const found = current.find(x => x.productId === item.productId); if (found) return current.map(x => x.productId === item.productId ? { ...x, ...item, quantity: Math.min(x.quantity + item.quantity, item.stock) } : x); return [...current, { ...item, quantity: Math.min(item.quantity, item.stock) }]; }),
    setQuantity: (productId: string, quantity: number) => setItems(current => current.map(x => x.productId === productId ? { ...x, quantity: Math.max(1, Math.min(Math.floor(quantity), x.stock)) } : x).filter(x => x.stock > 0)),
    remove: (productId: string) => setItems(current => current.filter(x => x.productId !== productId)),
    clear: () => setItems([]),
    count: items.reduce((n, x) => n + x.quantity, 0),
    subtotal: items.reduce((n, x) => n + x.price * x.quantity, 0),
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() { const value = useContext(CartContext); if (!value) throw new Error('useCart must be used inside CartProvider'); return value; }
