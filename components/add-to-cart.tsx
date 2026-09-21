'use client';

import { useState } from 'react';
import { useCart } from './cart-provider';

export default function AddToCart({ product }: { product: { id: string; name: string; price: number; image?: string; stock: number } }) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (product.stock < 1) return <button disabled className="mt-4 w-full rounded-2xl bg-slate-700/70 px-4 py-3 text-sm font-bold text-slate-300">Out of stock</button>;

  return <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.035] p-3 shadow-lg shadow-black/10">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-1">
        <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-10 w-10 rounded-lg border border-white/10 bg-white/5 text-lg font-bold hover:bg-white/10" aria-label="Decrease quantity">−</button>
        <span className="w-7 text-center text-sm font-bold">{quantity}</span>
        <button type="button" onClick={() => setQuantity(q => Math.min(product.stock, q + 1))} className="h-10 w-10 rounded-lg border border-white/10 bg-white/5 text-lg font-bold hover:bg-white/10" aria-label="Increase quantity">+</button>
      </div>
      <span className="text-right text-[11px] font-semibold text-slate-500">{product.stock} available</span>
    </div>
    <button type="button" onClick={() => { add({ productId: product.id, name: product.name, price: product.price, image: product.image, quantity, stock: product.stock }); setAdded(true); }} className="mt-3 min-h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-950/30 hover:-translate-y-0.5 hover:shadow-violet-950/50">{added ? 'Added ✓' : 'Add to cart'}</button>
  </div>;
}