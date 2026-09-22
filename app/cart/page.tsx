'use client';

import Link from 'next/link';
import { useCart } from '../../components/cart-provider';

export default function CartPage() {
  const { items, setQuantity, remove, subtotal } = useCart();
  const count = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <main className="min-h-screen bg-[#070b16] px-4 pb-28 pt-5 text-white sm:px-6 sm:py-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-4">
          <Link href="/" className="text-xl font-black tracking-tight sm:text-2xl">🛍️ Zenvora<span className="text-fuchsia-500">.</span></Link>
          <Link href="/products" className="rounded-xl border border-white/10 bg-white/[.025] px-3 py-2 text-xs font-bold text-slate-300 hover:bg-white/5 sm:text-sm">Continue shopping →</Link>
        </header>

        <div className="mt-7 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-violet-400">Shopping cart</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Your cart</h1>
            <p className="mt-2 text-xs text-slate-500">Review your items before secure checkout.</p>
          </div>
          {items.length > 0 && <span className="zenvora-pill shrink-0 px-3 py-1.5 text-xs font-bold text-slate-300">{count} {count === 1 ? 'item' : 'items'}</span>}
        </div>

        {!items.length ? (
          <div className="zenvora-empty-state mx-auto mt-10 max-w-lg">
            <div className="text-6xl">🛒</div>
            <p className="mt-5 text-lg font-black">Your cart is empty</p>
            <p className="mt-2 text-sm text-slate-500">Find something you love and add it here.</p>
            <Link href="/products" className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">Explore products →</Link>
          </div>
        ) : (
          <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_360px]">
            <section className="space-y-3">
              {items.map(item => (
                <div key={item.productId} className="zenvora-card flex gap-3 p-3 sm:gap-4 sm:p-4">
                  <Link href="/products" aria-label="Continue shopping" className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/[.04] sm:h-28 sm:w-28">
                    {item.image ? <img src={item.image} alt="" className="h-full w-full object-contain p-2"/> : <span className="grid h-full place-items-center text-3xl">🛍️</span>}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-sm font-bold leading-5 sm:text-base">{item.name}</h2>
                        <p className="mt-1 text-sm font-black">₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <strong className="shrink-0 text-sm sm:text-base">₹{(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
                        <button aria-label="Decrease quantity" onClick={() => setQuantity(item.productId, item.quantity - 1)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-white/10">−</button>
                        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)} className="grid h-8 w-8 place-items-center rounded-lg text-lg hover:bg-white/10">+</button>
                      </div>
                      <button onClick={() => remove(item.productId)} className="rounded-lg px-2 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            <aside className="zenvora-glass h-fit rounded-3xl p-5 lg:sticky lg:top-20">
              <p className="text-xs font-black uppercase tracking-widest text-violet-400">Summary</p>
              <h2 className="mt-1 text-xl font-black">Order summary</h2>
              <div className="mt-5 flex justify-between text-sm text-slate-300"><span>Subtotal</span><strong className="text-white">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
              <div className="my-4 border-t border-white/10"/>
              <div className="flex items-start gap-2 rounded-xl border border-emerald-400/10 bg-emerald-400/5 p-3 text-xs text-slate-400"><span>🔒</span><span>Secure checkout. Delivery charges and final total are calculated securely at checkout.</span></div>
              <Link href="/checkout" className="mt-5 block rounded-xl bg-white px-5 py-3.5 text-center text-sm font-black text-slate-950 shadow-xl shadow-black/20 hover:-translate-y-0.5">Proceed to checkout →</Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
