'use client';

import Link from 'next/link';
import { useCart } from '../../components/cart-provider';

export default function CartPage() {
  const { items, setQuantity, remove, subtotal } = useCart();
  return <main className="min-h-screen bg-[#070b16] px-0 py-5 text-white sm:py-8">
    <div className="flex items-center justify-between"><Link href="/" className="text-xl font-black">🛍️ Zenvora<span className="text-fuchsia-500">.</span></Link><Link href="/products" className="text-xs font-bold text-slate-500 sm:text-sm">Continue shopping →</Link></div>
    <div className="mt-6 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-widest text-violet-600">Shopping cart</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Your cart</h1></div>{items.length > 0 && <span className="text-xs text-slate-500">{items.reduce((n, i) => n + i.quantity, 0)} items</span>}</div>
    {!items.length ? <div className="mx-auto max-w-md py-20 text-center"><div className="text-5xl">🛒</div><p className="mt-4 font-bold">Your cart is empty.</p><p className="mt-1 text-sm text-slate-500">Find something you love and add it here.</p><Link href="/products" className="mt-5 inline-block rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white">Shop products</Link></div> :
      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="space-y-3">{items.map(item => <div key={item.productId} className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm shadow-black/20">
          <Link href="/products" className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5 sm:h-24 sm:w-24">{item.image && <img src={item.image} alt="" className="h-full w-full object-cover"/>}</Link>
          <div className="min-w-0 flex-1"><h2 className="line-clamp-2 text-sm font-bold sm:text-base">{item.name}</h2><p className="mt-1 text-sm font-black">₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            <div className="mt-2 flex items-center gap-2"><button onClick={() => setQuantity(item.productId, item.quantity - 1)} className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-lg hover:bg-white/10">−</button><span className="w-5 text-center text-sm font-bold">{item.quantity}</span><button onClick={() => setQuantity(item.productId, item.quantity + 1)} className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 text-lg hover:bg-white/10">+</button><button onClick={() => remove(item.productId)} className="ml-1 text-xs font-bold text-rose-400 hover:text-rose-300">Remove</button></div>
          </div>
          <strong className="hidden self-start text-sm sm:block">₹{(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>)}</section>
        <aside className="h-fit rounded-3xl border border-white/10 bg-white/5 p-5 shadow-sm shadow-black/20 lg:sticky lg:top-20"><h2 className="text-lg font-black">Order summary</h2><div className="mt-4 flex justify-between text-sm"><span>Subtotal</span><strong>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div><p className="mt-2 text-xs text-slate-500">Delivery and final total are calculated securely at checkout.</p><Link href="/checkout" className="mt-5 block rounded-xl bg-white px-5 py-3.5 text-center text-sm font-black text-slate-950 hover:-translate-y-0.5">Proceed to checkout →</Link></aside>
      </div>}
  </main>;
}