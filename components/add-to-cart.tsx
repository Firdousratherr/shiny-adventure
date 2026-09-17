'use client';
import { useState } from 'react';
import { useCart } from './cart-provider';
export default function AddToCart({ product }: { product: { id: string; name: string; price: number; image?: string; stock: number } }) {
  const { add } = useCart(); const [quantity, setQuantity] = useState(1); const [added, setAdded] = useState(false);
  if (product.stock < 1) return <button disabled className="mt-8 w-full rounded-xl bg-slate-300 px-6 py-4 font-bold text-slate-600">Out of stock</button>;
  return <div className="mt-8 space-y-3"><div className="flex items-center gap-3"><button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-11 w-11 rounded-lg border text-xl" aria-label="Decrease quantity">−</button><span className="w-10 text-center font-bold">{quantity}</span><button type="button" onClick={() => setQuantity(q => Math.min(product.stock, q + 1))} className="h-11 w-11 rounded-lg border text-xl" aria-label="Increase quantity">+</button><span className="text-sm text-slate-500">{product.stock} available</span></div><button type="button" onClick={() => { add({ productId: product.id, name: product.name, price: product.price, image: product.image, quantity, stock: product.stock }); setAdded(true); }} className="w-full rounded-xl bg-slate-900 px-6 py-4 font-bold text-white">{added ? 'Added to cart ✓' : 'Add to cart'}</button></div>;
}
