'use client';
import { useState } from 'react';
import { useCart } from './cart-provider';

export default function AddToCart({ product }: { product: { id: string; name: string; price: number; image?: string; stock: number } }) {
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  if (product.stock < 1) return <button disabled className="mt-3 w-full rounded-xl bg-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600">Out of stock</button>;
  return <div className="mt-3 space-y-2">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-9 w-9 rounded-lg border text-lg" aria-label="Decrease quantity">−</button>
        <span className="w-6 text-center text-sm font-bold">{quantity}</span>
        <button type="button" onClick={() => setQuantity(q => Math.min(product.stock, q + 1))} className="h-9 w-9 rounded-lg border text-lg" aria-label="Increase quantity">+</button>
      </div>
      <span className="text-[10px] text-slate-500">{product.stock} available</span>
    </div>
    <button type="button" onClick={() => { add({ productId: product.id, name: product.name, price: product.price, image: product.image, quantity, stock: product.stock }); setAdded(true); }} className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">{added ? 'Added ✓' : 'Add to cart'}</button>
  </div>;
}