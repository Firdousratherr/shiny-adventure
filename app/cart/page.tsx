'use client';

import Link from 'next/link';
import { useCart } from '../../components/cart-provider';
import StoreHeader from '../../components/store-header';

export default function CartPage() {
  const { items, setQuantity, remove, subtotal } = useCart();
  const count = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <main className="store-dark min-h-screen pb-28 sm:pb-10">
      <StoreHeader />

      <div className="container py-7 sm:py-10">
        <div className="zenvora-page-hero">
          <div>
            <span className="inline-flex rounded-full bg-fuchsia-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-700">Shopping cart</span>
            <h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-5xl">Ready to check out?</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Review your items, adjust quantities, then continue to secure checkout.</p>
          </div>
          <Link href="/products" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:border-violet-300 hover:text-violet-700 sm:inline-flex">Continue shopping →</Link>
        </div>

        {!items.length ? (
          <div className="zenvora-empty-state mx-auto mt-10 max-w-xl">
            <div className="text-6xl">🛒</div>
            <p className="mt-5 text-xl font-black">Your cart is empty</p>
            <p className="mt-2 text-sm text-slate-500">Explore the catalog and add something worth keeping.</p>
            <Link href="/products" className="mt-6 inline-flex rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20">Explore products →</Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px]">
            <section className="space-y-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-bold text-slate-500">{count} {count === 1 ? 'item' : 'items'}</p>
                <Link href="/products" className="text-xs font-black text-violet-700 hover:text-fuchsia-600 sm:hidden">Continue shopping →</Link>
              </div>

              {items.map((item) => (
                <article key={item.productId} className="zenvora-cart-item">
                  <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:h-32 sm:w-32">
                    {item.image ? <img src={item.image} alt="" className="h-full w-full object-contain p-2" /> : <span className="grid h-full place-items-center text-4xl">🛍️</span>}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="line-clamp-2 text-sm font-black leading-5 sm:text-base">{item.name}</h2>
                        <p className="mt-1 text-xs text-slate-500">Unit price</p>
                        <p className="mt-0.5 text-lg font-black">₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <p className="shrink-0 text-base font-black sm:text-lg">₹{(item.price * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                        <button aria-label="Decrease quantity" onClick={() => setQuantity(item.productId, item.quantity - 1)} className="grid h-9 w-9 place-items-center rounded-lg text-lg text-slate-600 hover:bg-violet-50 hover:text-violet-700">−</button>
                        <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                        <button aria-label="Increase quantity" onClick={() => setQuantity(item.productId, item.quantity + 1)} className="grid h-9 w-9 place-items-center rounded-lg text-lg hover:bg-white/10">+</button>
                      </div>
                      <button onClick={() => remove(item.productId)} className="rounded-lg px-2 py-2 text-xs font-black text-rose-600 hover:bg-rose-50">Remove</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="zenvora-order-summary h-fit lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-400">Your order</p>
                  <h2 className="mt-1 text-xl font-black">Order summary</h2>
                </div>
                <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-400">{count} items</span>
              </div>

              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between gap-4 text-slate-400"><span>Subtotal</span><span className="font-bold text-white">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                <div className="flex justify-between gap-4 text-slate-500"><span>Delivery</span><span>Calculated at checkout</span></div>
              </div>

              <div className="my-5 border-t border-white/10" />
              <div className="flex items-end justify-between gap-4"><span className="font-bold">Estimated total</span><strong className="text-2xl font-black">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>

              <div className="mt-5 rounded-2xl border border-emerald-400/10 bg-emerald-400/[.05] p-3 text-xs leading-5 text-slate-400">
                <span className="mr-2">🔒</span>Secure checkout. Final shipping, coupon and total are verified on the server.
              </div>

              <Link href="/checkout" className="zenvora-primary-btn mt-5 flex min-h-12 items-center justify-center rounded-xl px-5 py-3.5 text-center text-sm font-black">Proceed to checkout →</Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
