'use client';

import { useState } from 'react';

type Values = {
  storeName:string; storeDescription:string; upiId:string; upiDisplayName:string;
  freeShippingThreshold:string; flatDeliveryCharge:string; supportEmail:string;
  supportPhone:string; whatsappNumber:string;
};

export default function StoreSettings({ initial, razorpayEnabled, razorpayKeyId }: { initial: Values; razorpayEnabled:boolean; razorpayKeyId:string }) {
  const [v,setV]=useState(initial);
  const [rpOn,setRpOn]=useState(razorpayEnabled);
  const [rpKey,setRpKey]=useState(razorpayKeyId);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const set=(key:keyof Values,value:string)=>setV(x=>({...x,[key]:value}));
  async function save(){
    setBusy(true);setMessage('');setError('');
    try{
      const r=await fetch('/api/admin/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...v,razorpayEnabled:rpOn,razorpayKeyId:rpKey})});
      const d=await r.json(); if(!r.ok) throw new Error(d.error||'Unable to save settings.');
      setMessage('Settings saved successfully.');
    }catch(e){setError(e instanceof Error?e.message:'Unable to save settings.')}finally{setBusy(false)}
  }
  const input=(key:keyof Values,label:string,placeholder='')=><label className="block text-sm font-semibold text-slate-700">{label}<input value={v[key]} onChange={e=>set(key,e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"/></label>;
  return <div className="mt-8 space-y-6">
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="text-xl font-black">Store information</h2><p className="mt-1 text-sm text-slate-500">These values control customer-facing store information.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{input('storeName','Store name','Zenvora')}{input('supportEmail','Support email','support@example.com')}{input('supportPhone','Support phone','10-digit number')}{input('whatsappNumber','WhatsApp number','919876543210')}</div>
      <label className="mt-4 block text-sm font-semibold text-slate-700">Store description<textarea value={v.storeDescription} onChange={e=>set('storeDescription',e.target.value)} maxLength={300} className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-3"/></label>
    </section>
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="text-xl font-black">Shipping</h2><p className="mt-1 text-sm text-slate-500">Free shipping applies when the cart subtotal reaches the threshold.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{input('freeShippingThreshold','Free shipping threshold ₹','999')}{input('flatDeliveryCharge','Flat delivery charge ₹','79')}</div>
    </section>
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="text-xl font-black">Manual UPI</h2><p className="mt-1 text-sm text-slate-500">Customers can pay by UPI and submit their UTR plus screenshot for manual verification.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{input('upiId','UPI ID','yourname@upi')}{input('upiDisplayName','UPI display name','Zenvora')}</div>
    </section>
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="text-xl font-black">Razorpay</h2><p className="mt-1 text-sm text-slate-500">Enable direct online payment after adding the server-side Razorpay secrets in Vercel.</p>
      <label className="mt-5 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={rpOn} onChange={e=>setRpOn(e.target.checked)} className="h-5 w-5"/> Enable Razorpay at checkout</label>
      <label className="mt-4 block text-sm font-semibold text-slate-700">Razorpay Key ID<input value={rpKey} onChange={e=>setRpKey(e.target.value)} placeholder="rzp_test_... or rzp_live_..." className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3"/></label>
      <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><b>Never put secrets here.</b> Keep <code>RAZORPAY_KEY_SECRET</code> and <code>RAZORPAY_WEBHOOK_SECRET</code> only in Vercel environment variables.</p>
    </section>
    {(error||message)&&<p className={`rounded-xl p-4 text-sm font-semibold ${error?'bg-red-50 text-red-700':'bg-emerald-50 text-emerald-700'}`}>{error||message}</p>}
    <button disabled={busy} onClick={save} className="w-full rounded-xl bg-slate-950 px-5 py-4 font-bold text-white disabled:opacity-50">{busy?'Saving settings…':'Save all settings'}</button>
  </div>;
}
