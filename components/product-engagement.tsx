'use client';

import { useEffect, useState } from 'react';

type Review = { id:string; rating:number; title:string|null; body:string|null; customerName:string; verified:boolean; createdAt:string };

export default function ProductEngagement({ productId, stock }: { productId:string; stock:number }) {
  const [reviews,setReviews]=useState<Review[]>([]);
  const [alertEmail,setAlertEmail]=useState('');
  const [alertSent,setAlertSent]=useState(false);
  const [alertError,setAlertError]=useState('');

  useEffect(() => {
    let sessionId = localStorage.getItem('zenvora_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('zenvora_session_id', sessionId);
    }
    void fetch('/api/recently-viewed', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ productId, sessionId }),
    }).catch(()=>{});
    void fetch('/api/product-reviews?productId='+encodeURIComponent(productId), { cache:'no-store' })
      .then(r=>r.ok?r.json():null)
      .then(d=>{ if (Array.isArray(d?.reviews)) setReviews(d.reviews); })
      .catch(()=>{});
  }, [productId]);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setAlertError('');
    try {
      const r=await fetch('/api/stock-alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId,email:alertEmail})});
      const d=await r.json();
      if(!r.ok) throw new Error(d.error||'Unable to create stock alert.');
      setAlertSent(true);
    } catch(e) {
      setAlertError(e instanceof Error?e.message:'Unable to create stock alert.');
    }
  }

  const average = reviews.length ? reviews.reduce((sum,r)=>sum+r.rating,0)/reviews.length : 0;

  return <div className="mt-8 space-y-5">
    {stock <= 0 && <section className="rounded-2xl border border border-amber-200 bg-amber-50 p-5">
      <h2 className="font-black">Want to know when it is back?</h2>
      <p className="mt-1 text-sm text-slate-500">Leave your email and Zenvora can alert you when stock returns.</p>
      {alertSent ? <p className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-700">Stock alert registered.</p> :
      <form onSubmit={subscribe} className="mt-4 flex flex-col gap-2 sm:flex-row"><input required type="email" value={alertEmail} onChange={e=>setAlertEmail(e.target.value)} placeholder="you@example.com" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-400"/><button className="h-11 rounded-xl bg-white px-4 text-sm font-black text-slate-950">Notify me</button></form>}
      {alertError&&<p className="mt-2 text-xs font-semibold text-rose-700">{alertError}</p>}
    </section>}
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-fuchsia-600">Customer feedback</p><h2 className="mt-1 text-2xl font-black">Reviews</h2></div>{reviews.length>0&&<div className="text-right"><p className="text-2xl font-black">{average.toFixed(1)} ★</p><p className="text-xs text-slate-500">{reviews.length} review{reviews.length===1?'':'s'}</p></div>}</div>
      {!reviews.length ? <p className="mt-5 text-sm text-slate-500">No approved reviews yet. Be the first customer to share feedback.</p> :
      <div className="mt-5 space-y-3">{reviews.slice(0,6).map(r=><article key={r.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div className="font-bold">{r.customerName}</div><span className="text-amber-300">{'★'.repeat(r.rating)}<span className="text-slate-700">{'★'.repeat(5-r.rating)}</span></span></div>{r.verified&&<span className="mt-1 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Verified purchase</span>}{r.title&&<h3 className="mt-2 font-bold">{r.title}</h3>}{r.body&&<p className="mt-1 text-sm leading-6 text-slate-400">{r.body}</p>}</article>)}</div>}
    </section>
  </div>;
}
