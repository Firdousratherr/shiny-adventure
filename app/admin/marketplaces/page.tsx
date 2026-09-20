'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Integration = {
  id: string;
  provider: string;
  enabled: boolean;
  autoSync: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  importedProducts: number;
  importedOrders: number;
  credentialsConfigured: boolean;
};
const labels: Record<string,{name:string;description:string}> = {
  AMAZON:{name:'Amazon',description:'Import products and seller orders through the official Amazon Selling Partner API.'},
  FLIPKART:{name:'Flipkart',description:'Connect your seller account and sync marketplace data through an official seller integration.'},
  MEESHO:{name:'Meesho',description:'Connect your supplier/seller integration and keep marketplace data in sync.'},
};

export default function MarketplacesPage(){
  const [items,setItems]=useState<Integration[]>([]);
  const [forbidden,setForbidden]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');

  const load=async()=>{
    setLoading(true); setError('');
    try{
      const r=await fetch('/api/admin/marketplaces',{cache:'no-store'});
      const j=await r.json();
      if(r.status===403){setForbidden(true);return}
      if(!r.ok) throw new Error(j.error||'Unable to load marketplace settings.');
      setItems(j.integrations);
    }catch(e){setError(e instanceof Error?e.message:'Unable to load marketplace settings.')}
    finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);

  const update=async(provider:string,data:Record<string,unknown>)=>{
    setBusy(provider);setError('');setMessage('');
    try{
      const r=await fetch('/api/admin/marketplaces',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider,...data})});
      const j=await r.json(); if(!r.ok) throw new Error(j.error||'Update failed.');
      setItems(x=>x.map(i=>i.provider===provider?{...i,...j.integration}:i));
      if(j.warning)setMessage(j.warning);
    }catch(e){setError(e instanceof Error?e.message:'Update failed.')}
    finally{setBusy('')}
  };

  const sync=async(provider:string)=>{
    setBusy(provider);setError('');setMessage('');
    try{
      const r=await fetch('/api/admin/marketplaces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider})});
      const j=await r.json();
      if(r.status===501){setError(j.error||'Sync adapter is not configured yet.');return}
      if(!r.ok) throw new Error(j.error||'Sync failed.');
      setMessage('Sync completed.');
      await load();
    }catch(e){setError(e instanceof Error?e.message:'Sync failed.')}
    finally{setBusy('')}
  };

  if(forbidden)return <main className="min-h-screen bg-slate-100 p-6"><div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-black">Marketplace permission required</h1><p className="mt-2 text-sm text-slate-500">Ask the Super Admin to grant the Marketplaces permission.</p><Link href="/admin/dashboard" className="mt-5 inline-block rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white">Back to dashboard</Link></div></main>;

  return <main className="min-h-screen bg-slate-100">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="container flex min-h-16 items-center justify-between gap-3"><Link href="/admin/dashboard" className="text-xl font-black">zenvora<span className="text-indigo-600">.</span><span className="ml-2 text-xs uppercase tracking-widest text-slate-400">Admin</span></Link><Link href="/admin/dashboard" className="rounded-xl px-3 py-2 text-sm font-bold">← Dashboard</Link></div></header>
    <div className="container py-6 sm:py-8">
      <p className="text-xs font-black uppercase tracking-widest text-indigo-600">Marketplace integrations</p>
      <h1 className="mt-1 text-3xl font-black">Amazon, Flipkart & Meesho</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate-500">Turn each marketplace on or off independently. When connected, the integration is designed to import products and orders into Zenvora with duplicate protection and sync history.</p>
      {error&&<div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {message&&<div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}
      {loading?<div className="mt-6 rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Loading integrations…</div>:
      <div className="mt-6 grid gap-4 lg:grid-cols-3">{items.map(i=>{
        const meta=labels[i.provider]; const disabled=busy===i.provider;
        return <section key={i.provider} className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">{meta?.name||i.provider}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{meta?.description}</p></div>
          <button disabled={disabled} onClick={()=>update(i.provider,{enabled:!i.enabled})} className={`relative h-7 w-12 shrink-0 rounded-full transition ${i.enabled?'bg-emerald-500':'bg-slate-300'}`} aria-label={i.enabled?'Disable':'Enable'}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${i.enabled?'left-6':'left-1'}`}/></button></div>
          <div className="mt-4 rounded-xl border p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-500">Status</span><span className={`text-xs font-black ${i.enabled?'text-emerald-600':'text-slate-500'}`}>{i.enabled?'ON':'OFF'}</span></div>
          <div className="mt-2 text-xs">{i.credentialsConfigured?<span className="font-bold text-emerald-700">API credentials detected</span>:<span className="font-bold text-amber-700">API credentials not configured</span>}</div></div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-slate-50 p-3"><b className="block text-base">{i.importedProducts}</b>Imported products</div><div className="rounded-xl bg-slate-50 p-3"><b className="block text-base">{i.importedOrders}</b>Imported orders</div></div>
          <label className="mt-4 flex items-center justify-between rounded-xl border p-3"><span><b className="block text-sm">Automatic sync</b><span className="text-[11px] text-slate-500">Runs when an official adapter is connected</span></span><input type="checkbox" checked={i.autoSync} disabled={disabled||!i.enabled} onChange={e=>update(i.provider,{autoSync:e.target.checked})}/></label>
          <label className="mt-2 block text-xs font-bold text-slate-500">Sync interval<select value={i.syncIntervalMinutes} disabled={disabled||!i.autoSync} onChange={e=>update(i.provider,{syncIntervalMinutes:Number(e.target.value)})} className="mt-1.5 h-10 w-full rounded-xl border bg-white px-3 text-sm text-slate-900"><option value="15">Every 15 minutes</option><option value="30">Every 30 minutes</option><option value="60">Every hour</option><option value="180">Every 3 hours</option><option value="360">Every 6 hours</option><option value="720">Every 12 hours</option><option value="1440">Daily</option></select></label>
          <button disabled={disabled||!i.enabled} onClick={()=>sync(i.provider)} className="mt-4 h-11 w-full rounded-xl bg-slate-900 text-sm font-black text-white disabled:opacity-40">{disabled?'Working…':'Sync now'}</button>
          <div className="mt-3 text-[11px] text-slate-400">{i.lastSuccessAt ? 'Last success: ' + new Date(i.lastSuccessAt).toLocaleString('en-IN') : 'Never successfully synced'}</div>
          {i.lastError&&<div className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] font-semibold text-red-700">{i.lastError}</div>}
        </section>
      })}</div>}
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><b>Important:</b> Zenvora will use official seller APIs only. It will not scrape marketplace websites. Amazon&apos;s official SP-API supports programmatic seller operations, but credentials and provider-specific authorization are required.</div>
    </div>
  </main>
}
