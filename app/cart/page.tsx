'use client';

import Link from 'next/link';
import StoreHeader from '../../components/store-header';
import StoreFooter from '../../components/store-footer';
import { useCart } from '../../components/cart-provider';

export default function CartPage() {
  const { items, setQuantity, remove, subtotal } = useCart();
  const count=items.reduce((n,i)=>n+i.quantity,0);

  return (
    <main id="main-content" className="store-shell">
      <StoreHeader />
      <div className="store-container pb-12 pt-7 sm:pt-10">
        <div className="store-page-heading">
          <div><p className="store-kicker">Your selection</p><h1 className="store-page-title">Shopping cart</h1><p className="mt-2 text-sm text-slate-500">{count+' '+(count===1?'item':'items')+' ready for checkout.'}</p></div>
          {items.length>0&&<Link href="/products" className="store-secondary-btn hidden sm:inline-flex">Continue shopping →</Link>}
        </div>

        {!items.length ? (
          <div className="store-empty mt-10 max-w-2xl mx-auto">
            <div className="store-empty-icon">🛒</div><h2>Your cart is empty</h2><p>Explore the collection and add something useful, stylish or simply fun.</p>
            <Link href="/products" className="store-primary-btn mt-5">Start shopping <span>→</span></Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_370px]">
            <section className="space-y-3">
              {items.map(item=>(
                <article key={item.productId} className="store-cart-card">
                  <Link href={item.slug?('/product/'+item.slug):'/products'} className="store-cart-image" aria-label={'View '+item.name}>
                    {item.image?<img src={item.image} alt="" loading="lazy"/>:<span>Z</span>}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link href={item.slug?('/product/'+item.slug):'/products'} className="line-clamp-2 text-sm font-extrabold leading-5 text-slate-900 hover:text-violet-700 sm:text-base">{item.name}</Link>
                        <p className="mt-1 text-sm font-bold text-slate-500">₹{item.price.toLocaleString('en-IN',{minimumFractionDigits:2})} each</p>
                      </div>
                      <strong className="shrink-0 text-sm font-black text-slate-950">₹{(item.price*item.quantity).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="store-quantity"><button aria-label="Decrease quantity" onClick={()=>setQuantity(item.productId,item.quantity-1)}>−</button><span>{item.quantity}</span><button aria-label="Increase quantity" onClick={()=>setQuantity(item.productId,item.quantity+1)}>+</button></div>
                      <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-slate-400">{item.stock} in stock</span><button onClick={()=>remove(item.productId)} className="rounded-xl px-3 py-2 text-xs font-extrabold text-rose-500 hover:bg-rose-50">Remove</button></div>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="store-summary-card lg:sticky lg:top-24 lg:h-fit">
              <p className="store-kicker">Checkout</p><h2 className="mt-1 text-2xl font-black text-slate-950">Order summary</h2>
              <div className="mt-6 space-y-3 text-sm"><div className="flex justify-between gap-4 text-slate-500"><span>Subtotal</span><strong className="text-slate-900">₹{subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></div><div className="flex justify-between gap-4 text-slate-500"><span>Delivery</span><span className="font-bold text-slate-400">Calculated at checkout</span></div></div>
              <div className="my-5 border-t border-slate-200" />
              <div className="flex items-end justify-between gap-4"><span className="font-extrabold text-slate-700">Estimated total</span><strong className="text-2xl font-black tracking-tight text-slate-950">₹{subtotal.toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></div>
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-3.5 text-xs leading-5 text-emerald-800"><span className="font-black">🔒 Secure checkout.</span> Final delivery charges and total are calculated securely on the server.</div>
              <Link href="/checkout" className="store-primary-btn mt-5 w-full justify-center">Proceed to checkout <span>→</span></Link>
            </aside>
          </div>
        )}
      </div>
      <StoreFooter />
    </main>
  );
}
