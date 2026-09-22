
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Settings = { markupPercent?: number; fixedAmount?: number; maxItemsPerSync?: number; syncProducts?: boolean; syncOrders?: boolean; syncInventory?: boolean };
type Integration = { id: string; provider: 'SHOPIFY'; enabled: boolean; autoSync: boolean; syncIntervalMinutes: number; lastSuccessAt: string | null; lastError: string | null; importedProducts: number; healthStatus: string; lastSyncDurationMs: number | null; settings: Settings | null; credentialsConfigured: boolean; capabilities: { products: boolean; orders: boolean; inventory: boolean; note: string } };
type Collection = { id: string; title: string; handle: string; productsCount: number };
type Product = { id: string; title: string; imageUrl: string | null; price: number; inventory: number; url: string | null; productType: string; vendor: string; collections: string[]; imported: boolean };

export default function MarketplacesPage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [scope, setScope] = useState<'selected' | 'collections' | 'all'>('selected');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [markup, setMarkup] = useState(0);
  const [fixed, setFixed] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/admin/marketplaces', { cache: 'no-store' }); const j = await r.json();
      if (r.status === 403) { setForbidden(true); return; }
      if (!r.ok) throw new Error(j.error || 'Unable to load Shopify.');
      setIntegration((j.integrations?.[0] ?? null) as Integration | null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load Shopify.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const update = async (patch: Record<string, unknown>) => {
    setBusy(true); setError(''); setMessage('');
    try { const r = await fetch('/api/admin/marketplaces', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ provider:'SHOPIFY', ...patch }) }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Update failed.'); setIntegration(x => x ? {...x, ...j.integration, credentialsConfigured:j.credentialsConfigured ?? x.credentialsConfigured, capabilities:j.capabilities ?? x.capabilities} : x); }
    catch (e) { setError(e instanceof Error ? e.message : 'Update failed.'); } finally { setBusy(false); }
  };
  const sync = async () => {
    setBusy(true); setError(''); setMessage('');
    try { const r = await fetch('/api/admin/marketplaces', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({provider:'SHOPIFY'}) }); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Sync failed.'); setMessage(`Automatic sync complete: ${j.importedProducts} products processed.`); await load(); }
    catch(e){setError(e instanceof Error?e.message:'Sync failed.');} finally{setBusy(false);}
  };
  const loadCatalog = async (mode: 'products' | 'collections' = 'products') => {
    setLoadingCatalog(true); setError('');
    try {
      if (mode === 'collections') { const r=await fetch('/api/admin/marketplaces/shopify/collections'); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Unable to load collections.'); setCollections(j.collections||[]); }
      const params = new URLSearchParams({ scope, search }); if (scope==='collections') selectedCollections.forEach(x=>params.append('collectionId',x));
      const r=await fetch('/api/admin/marketplaces/shopify/products?'+params.toString()); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Unable to load products.');
      setProducts(j.products||[]); setSelectedProducts([]);
    } catch(e){setError(e instanceof Error?e.message:'Unable to load Shopify catalog.');} finally{setLoadingCatalog(false);}
  };
  useEffect(() => { if (integration?.credentialsConfigured) void loadCatalog('collections'); }, [integration?.credentialsConfigured]);
  useEffect(() => { if (integration?.credentialsConfigured && scope !== 'collections') void loadCatalog(); }, [scope]);
  useEffect(() => { if (integration?.credentialsConfigured && scope === 'collections') void loadCatalog(); }, [selectedCollections.join('|')]);

  const visible = useMemo(() => products.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.productType.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const allVisibleSelected = visible.length > 0 && visible.every(p => selectedProducts.includes(p.id));
  const toggleAll = () => setSelectedProducts(allVisibleSelected ? selectedProducts.filter(id=>!visible.some(p=>p.id===id)) : Array.from(new Set([...selectedProducts,...visible.map(p=>p.id)])));

  const importProducts = async () => {
    setImporting(true); setError(''); setMessage('');
    try {
      let ids = scope === 'selected' ? selectedProducts : products.map(p=>p.id);
      if (scope === 'all') { const r=await fetch('/api/admin/marketplaces/shopify/products?scope=all'); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Unable to prepare all products.'); ids=(j.products||[]).map((p:Product)=>p.id); }
      if (!ids.length) throw new Error('Select at least one product, or choose a collection/all products.');
      const chunkSize=100; let created=0, updated=0, skipped=0, failed=0;
      for(let i=0;i<ids.length;i+=chunkSize){
        const r=await fetch('/api/admin/marketplaces/shopify/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productIds:ids.slice(i,i+chunkSize),markupPercent:markup,fixedAmount:fixed})});
        const j=await r.json(); if(!r.ok) throw new Error(j.error||'Import failed.'); created+=j.created||0; updated+=j.updated||0; skipped+=j.skipped||0; failed+=j.failed||0; setMessage(`Importing… ${Math.min(i+chunkSize,ids.length)}/${ids.length} | created ${created}, updated ${updated}, skipped ${skipped}`);
      }
      setMessage(`Import complete: ${created} created, ${updated} updated, ${skipped} skipped, ${failed} failed.`); await loadCatalog(); await load();
    } catch(e){setError(e instanceof Error?e.message:'Import failed.');} finally{setImporting(false);}
  };

  if (forbidden) return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto mt-20 max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-8 text-center"><h1 className="text-2xl font-black">Marketplace permission required</h1><p className="mt-3 text-sm text-slate-400">Ask the Super Admin to grant the Marketplaces permission.</p><Link href="/admin/dashboard" className="mt-6 inline-block rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">Back to dashboard</Link></div></main>;
  const settings=integration?.settings||{}; const ready=Boolean(integration?.credentialsConfigured);
  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <header className="border-b border-white/10 bg-slate-950/90"><div className="mx-auto flex min-h-20 max-w-6xl items-center justify-between px-4 sm:px-6"><div><Link href="/admin/dashboard" className="text-2xl font-black">zenvora<span className="text-indigo-400">.</span></Link><p className="text-[10px] font-black uppercase tracking-[.25em] text-slate-500">Marketplace control</p></div><div className="flex gap-2"><Link href="/admin/marketplaces/history" className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold">History</Link><button onClick={load} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold">Refresh</button><Link href="/admin/dashboard" className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950">Dashboard</Link></div></div></header>
    <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <section className="rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-white/[.04] to-indigo-500/10 p-6 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">Shopify</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Import Center</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Browse your Shopify catalog, choose products or collections, preview the selection, and control exactly what gets imported into Zenvora. Credentials remain Vercel-only.</p></div><span className={ready?'h-fit rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-300':'h-fit rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-amber-300'}>{ready?'CONNECTED':'SETUP REQUIRED'}</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Imported</p><p className="mt-1 text-xl font-black">{integration?.importedProducts??0}</p></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Health</p><p className="mt-1 text-xl font-black text-emerald-300">{integration?.healthStatus??'UNKNOWN'}</p></div><div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] font-black uppercase text-slate-500">Last sync</p><p className="mt-1 text-sm font-bold">{integration?.lastSuccessAt?new Date(integration.lastSuccessAt).toLocaleString('en-IN'):'Never'}</p></div></div></section>
      {error&&<div role="alert" className="mt-5 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}{message&&<div role="status" className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{message}</div>}
      {!loading&&!ready&&<section className="mt-5 rounded-3xl border border-amber-400/20 bg-amber-500/5 p-6 text-sm text-amber-200">Add <b>SHOPIFY_STORE_DOMAIN</b>, <b>SHOPIFY_CLIENT_ID</b>, and <b>SHOPIFY_CLIENT_SECRET</b> to Vercel Production, then redeploy.</section>}
      {ready&&<>
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[.04] p-5 sm:p-7"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-400">1 · Choose scope</p><h2 className="mt-1 text-xl font-black">What do you want to import?</h2></div><div className="flex flex-wrap gap-2">{(['selected','collections','all'] as const).map(x=><button key={x} onClick={()=>setScope(x)} className={scope===x?'rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950':'rounded-xl border border-white/10 px-4 py-2 text-xs font-bold'}>{x==='selected'?'Selected products':x==='collections'?'Collections':'ALL PRODUCTS'}</button>)}</div></div>
          {scope==='collections'&&<div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{collections.map(c=><label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 p-3 text-xs"><input type="checkbox" checked={selectedCollections.includes(c.id)} onChange={e=>setSelectedCollections(v=>e.target.checked?[...v,c.id]:v.filter(x=>x!==c.id))}/><span className="min-w-0"><b className="block truncate">{c.title}</b><span className="text-[10px] text-slate-500">{c.productsCount} products</span></span></label>)}</div>}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…" className="h-11 flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"/><button onClick={()=>loadCatalog()} disabled={loadingCatalog} className="rounded-2xl border border-white/10 px-5 text-xs font-black">{loadingCatalog?'Loading…':'Fetch catalog'}</button></div>
        </section>
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[.04] p-5 sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-400">2 · Review & control</p><h2 className="mt-1 text-xl font-black">{scope==='all'?'ALL PRODUCTS':visible.length} products in selection</h2><p className="mt-1 text-xs text-slate-500">Imported products are marked. Nothing is committed until you press Import.</p></div>{scope!=='all'&&<button onClick={toggleAll} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black">{allVisibleSelected?'Deselect all':'Select all visible'}</button>}</div>
          {scope==='all'&&<div className="mt-4 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4 text-xs text-indigo-200">All products mode will fetch the complete Shopify catalog and import it in controlled batches. Existing Shopify IDs are updated rather than duplicated.</div>}
          <div className="mt-5 grid gap-3">{visible.slice(0,100).map(p=><label key={p.id} className="flex gap-3 rounded-2xl border border-white/10 bg-black/10 p-3"><input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={e=>setSelectedProducts(v=>e.target.checked?[...v,p.id]:v.filter(x=>x!==p.id))} className="mt-2"/><div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-900">{p.imageUrl&&<img src={p.imageUrl} alt="" className="h-full w-full object-cover"/>}</div><div className="min-w-0 flex-1"><div className="flex gap-2"><b className="truncate text-sm">{p.title}</b>{p.imported&&<span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black text-emerald-300">IMPORTED</span>}</div><p className="mt-1 truncate text-[10px] text-slate-500">{p.productType||'Uncategorized'} · {p.vendor||'No vendor'} · Stock {p.inventory}</p><p className="mt-1 text-xs font-bold">₹{p.price.toFixed(2)}</p></div></label>)}{!visible.length&&<p className="py-8 text-center text-sm text-slate-500">No products found.</p>}</div>
        </section>
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[.04] p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-400">3 · Pricing & import</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-[10px] font-black uppercase text-slate-500">Markup %<input type="number" min="0" step=".1" value={markup} onChange={e=>setMarkup(Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm text-white"/></label><label className="text-[10px] font-black uppercase text-slate-500">Fixed amount<input type="number" min="0" step="1" value={fixed} onChange={e=>setFixed(Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm text-white"/></label></div><div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-slate-500">{scope==='selected'?selectedProducts.length:scope==='collections'?products.length:'All Shopify products'} selected · pricing is applied during import · existing Shopify IDs are deduplicated.</p><button onClick={importProducts} disabled={importing||loadingCatalog||(scope==='selected'&&!selectedProducts.length)} className="rounded-2xl bg-white px-6 py-3 text-xs font-black text-slate-950 disabled:opacity-30">{importing?'Importing…':scope==='all'?'Import ALL products':`Import ${scope==='selected'?selectedProducts.length:products.length} products`}</button></div></section>
      </>}
      <section className="mt-5 rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-400">Automatic sync</p><h2 className="mt-1 text-xl font-black">Keep imported products updated</h2><p className="mt-2 text-xs leading-5 text-slate-500">This is separate from the controlled importer. Use it for future product/stock updates.</p></div><button onClick={sync} disabled={busy||!ready||!integration?.enabled} className="rounded-xl bg-white px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-30">{busy?'Working…':'Sync Shopify now'}</button></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-[10px] font-black uppercase text-slate-500">Markup %<input type="number" min="0" step=".1" value={settings.markupPercent??0} onChange={e=>update({settings:{...settings,markupPercent:Number(e.target.value)}})} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4"/></label><label className="text-[10px] font-black uppercase text-slate-500">Fixed amount<input type="number" min="0" value={settings.fixedAmount??0} onChange={e=>update({settings:{...settings,fixedAmount:Number(e.target.value)}})} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4"/></label><label className="text-[10px] font-black uppercase text-slate-500">Interval<select value={integration?.syncIntervalMinutes??1440} onChange={e=>update({syncIntervalMinutes:Number(e.target.value)})} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4"><option value="60">1 hour</option><option value="180">3 hours</option><option value="360">6 hours</option><option value="720">12 hours</option><option value="1440">Daily</option></select></label></div><label className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs"><span><b className="block">Automatic sync</b><span className="text-[10px] text-slate-500">Uses configured server cron.</span></span><input type="checkbox" checked={Boolean(integration?.autoSync)} disabled={busy||!integration?.enabled} onChange={e=>update({autoSync:e.target.checked})}/></label></section>
    </div></main>;
}
