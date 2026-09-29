'use client';

import { FormEvent,useState } from 'react';
import Link from 'next/link';
import StoreHeader from '../../components/store-header';
import StoreFooter from '../../components/store-footer';

export default function Track(){
  const [orderNumber,setOrderNumber]=useState('');const [phone,setPhone]=useState('');const [result,setResult]=useState<any>(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setLoading(true);setError('');setResult(null);try{const r=await fetch('/api/orders/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderNumber,phone})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Order not found');setResult(d)}catch(err){setError(err instanceof Error?err.message:'Order not found.')}finally{setLoading(false)}}
  return (
    <main id="main-content" className="store-shell min-h-screen">
      <StoreHeader />
      <div className="store-container pb-12 pt-8 sm:pt-12">
        <div className="mx-auto max-w-3xl">
          <div className="text-center"><p className="store-kicker">Order support</p><h1 className="mt-2 text-4xl font-black tracking-[-.04em] text-slate-950">Track your order</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Enter the order number and mobile number used at checkout to see the latest status.</p></div>
          <section className="store-panel mx-auto mt-7 max-w-xl">
            <form onSubmit={submit} className="space-y-4">
              <label className="store-field-label">Order number<input value={orderNumber} onChange={e=>setOrderNumber(e.target.value.toUpperCase())} required placeholder="ORD-2026-0001"/></label>
              <label className="store-field-label">Mobile number<input value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,'').slice(0,10))} required inputMode="numeric" placeholder="10-digit mobile"/></label>
              {error&&<div className="store-error-box">{error}</div>}
              <button disabled={loading} className="store-primary-btn h-12 w-full disabled:opacity-55">{loading?'Checking…':'Track order'}<span>→</span></button>
            </form>
          </section>

          {result&&<section className="store-panel mx-auto mt-5 max-w-3xl store-reveal">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 pb-5"><div><p className="store-kicker">Order found</p><h2 className="mt-1 text-2xl font-black text-slate-950">#{result.orderNumber}</h2></div><span className="store-status">{String(result.status).replaceAll('_',' ')}</span></div>
            {result.trackingNumber&&<div className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-violet-700">{result.courierName||'Courier'}</p><p className="mt-1 text-sm font-extrabold text-slate-900">Tracking: {result.trackingNumber}</p>{result.trackingUrl&&/^https:\/\//i.test(result.trackingUrl)&&<a href={result.trackingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-extrabold text-violet-700">Open tracking page →</a>}</div>}
            <div className="mt-6"><p className="store-kicker">Order progress</p><div className="mt-3 space-y-2">{result.history.map((h:any)=><div key={h.createdAt+String(h.newStatus)} className="store-tracking-row"><span className="store-tracking-dot"/><div><b>{String(h.newStatus).replaceAll('_',' ')}</b><p>{new Date(h.createdAt).toLocaleString('en-IN')}</p></div></div>)}</div></div>
            <div className="mt-6 border-t border-slate-100 pt-6"><p className="store-kicker">Items</p><ul className="mt-2 divide-y divide-slate-100">{result.items.map((x:any)=><li key={x.productName} className="flex justify-between gap-4 py-3 text-sm"><span className="text-slate-600">{x.productName} × {x.quantity}</span><strong>₹{Number(x.unitPrice).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></li>)}</ul></div>
          </section>}
        </div>
      </div>
      <StoreFooter />
    </main>
  );
}
