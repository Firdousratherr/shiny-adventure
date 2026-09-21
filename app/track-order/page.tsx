'use client';
import { useState } from 'react';

const steps = ['PAYMENT_PENDING','CONFIRMED','ORDERED_FROM_SOURCE','SHIPPED','DELIVERED'];
const labels: Record<string,string> = { PAYMENT_PENDING:'Payment pending', CONFIRMED:'Order confirmed', ORDERED_FROM_SOURCE:'Processing', SHIPPED:'Shipped', DELIVERED:'Delivered', CANCELLED:'Cancelled', RTO:'Returned' };

export default function TrackOrderPage(){
 const [orderNumber,setOrderNumber]=useState(''),[phone,setPhone]=useState(''),[data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setLoading(true);setError('');setData(null);try{const r=await fetch('/api/track-order',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({orderNumber:orderNumber.trim(),phone:phone.trim()})});const j=await r.json();if(!r.ok)throw new Error(j.error||'Unable to find order.');setData(j.order);}catch(e){setError(e instanceof Error?e.message:'Unable to find order.')}finally{setLoading(false)}}
 const current=data?.status; const currentIndex=steps.indexOf(current);
 return <main className="min-h-screen bg-[#070b16] px-4 py-8 text-white sm:px-6 sm:py-12"><div className="mx-auto max-w-3xl">
   <div className="flex items-center justify-between"><a href="/" className="text-xl font-black">🛍️ Zenvora<span className="text-fuchsia-400">.</span></a><a href="/products" className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-slate-300">Shop</a></div>
   <div className="mt-8 text-center"><p className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-400">Order tracking</p><h1 className="mt-2 text-4xl font-black">Where is my order?</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400">Enter your order number and phone number to securely view the latest delivery status.</p></div>
   <form onSubmit={submit} className="zenvora-glass mx-auto mt-7 grid max-w-2xl gap-3 rounded-3xl p-4 sm:grid-cols-[1fr_1fr_auto] sm:p-5"><input value={orderNumber} onChange={e=>setOrderNumber(e.target.value)} placeholder="Order number" required className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"/><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="10-digit phone number" inputMode="tel" required className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"/><button disabled={loading} className="rounded-xl bg-white px-5 py-3 font-black text-slate-950 disabled:opacity-50">{loading?'Checking…':'Track order'}</button></form>
   {error&&<p className="mx-auto mt-4 max-w-2xl rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
   {data&&<section className="mt-7 space-y-5">
     <div className="zenvora-card rounded-3xl p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-slate-500">Order</p><h2 className="mt-1 text-xl font-black">{data.orderNumber}</h2></div><span className="zenvora-pill px-3 py-1.5 text-xs font-bold text-violet-200">{labels[current]||current}</span></div>
       {current!=='CANCELLED'&&current!=='RTO'&&<div className="mt-7 grid grid-cols-5 gap-1">{steps.map((s,i)=><div key={s} className="text-center"><div className="mx-auto h-2 rounded-full bg-white/10">{i<=currentIndex&&<div className="h-2 rounded-full bg-violet-500"/>}</div><p className="mt-2 hidden text-[10px] font-bold text-slate-400 sm:block">{labels[s]}</p></div>)}</div>}
       {data.trackingNumber&&<p className="mt-5 rounded-xl bg-white/5 p-3 text-sm"><b>Tracking:</b> {data.courierName||'Courier'} · {data.trackingNumber} {data.trackingUrl&&<a className="ml-2 font-bold text-violet-300 underline" href={data.trackingUrl} target="_blank" rel="noreferrer">Track shipment ↗</a>}</p>}
     </div>
     <div className="zenvora-card rounded-3xl p-5 sm:p-6"><h3 className="text-lg font-black">Status history</h3><div className="mt-4 space-y-3">{data.history.map((h:any)=><div key={h.createdAt+h.newStatus} className="flex gap-3 rounded-2xl bg-white/5 p-4"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-violet-400"/><div><b>{labels[h.newStatus]||h.newStatus}</b><p className="mt-1 text-xs text-slate-500">{new Date(h.createdAt).toLocaleString('en-IN')} · {h.note||'Status updated'}</p></div></div>)}</div></div>
   </section>}
 </div></main>;
}