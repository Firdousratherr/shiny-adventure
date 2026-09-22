
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type ImportMode = 'CREATE_ONLY' | 'UPDATE_ONLY' | 'CREATE_AND_UPDATE';
type RoundingMode = 'NONE' | 'NEAREST' | 'UP' | 'DOWN';
type Settings = {
  markupPercent?: number; fixedAmount?: number; maxItemsPerSync?: number; syncProducts?: boolean; syncOrders?: boolean; syncInventory?: boolean;
  mode?: ImportMode; skipExisting?: boolean; skipOutOfStock?: boolean; skipWithoutImages?: boolean; skipWithoutPrice?: boolean;
  minSourcePrice?: number; maxSourcePrice?: number; minInventory?: number;
  roundingMode?: RoundingMode; roundingValue?: number; minSellingPrice?: number; maxSellingPrice?: number;
  protectLockedPrice?: boolean; updatePrice?: boolean; importImages?: boolean; importDescriptions?: boolean; importInventory?: boolean;
};
type Integration = { id: string; provider: 'SHOPIFY'; enabled: boolean; autoSync: boolean; syncIntervalMinutes: number; lastSuccessAt: string | null; lastError: string | null; importedProducts: number; healthStatus: string; lastSyncDurationMs: number | null; settings: Settings | null; credentialsConfigured: boolean; capabilities: { products: boolean; orders: boolean; inventory: boolean; note: string } };
type Collection = { id: string; title: string; handle: string; productsCount: number };
type Product = { id: string; title: string; imageUrl: string | null; price: number; inventory: number; url: string | null; productType: string; vendor: string; collections: string[]; imported: boolean };
type PreviewRow = {
  externalId: string; title: string; sourceCost: number | null; currentSellingPrice: number | null; proposedSellingPrice: number;
  inventory: number | null; imageCount: number; existingImages: number; action: 'CREATE' | 'UPDATE' | 'SKIP'; reason: string; lockedPrice: boolean;
};

export default function MarketplacesPage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [scope, setScope] = useState<'selected' | 'collections' | 'all'>('selected');
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [rules, setRules] = useState({
    mode: 'CREATE_AND_UPDATE' as ImportMode, markupPercent: 0, fixedAmount: 0,
    skipExisting: false, skipOutOfStock: false, skipWithoutImages: true, skipWithoutPrice: true,
    minSourcePrice: '', maxSourcePrice: '', minInventory: '',
    roundingMode: 'NONE' as RoundingMode, roundingValue: '', minSellingPrice: '', maxSellingPrice: '',
    protectLockedPrice: true, updatePrice: true, importImages: true, importDescriptions: true, importInventory: true,
  });
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [previewSummary, setPreviewSummary] = useState({ total: 0, create: 0, update: 0, skip: 0 });
  const cancelRequested = useRef(false);
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
      const nextIntegration = (j.integrations?.[0] ?? null) as Integration | null;
      setIntegration(nextIntegration);
      const saved = nextIntegration?.settings ?? {};
      setRules(current => ({
        ...current,
        mode: saved.mode ?? current.mode,
        markupPercent: saved.markupPercent ?? current.markupPercent,
        fixedAmount: saved.fixedAmount ?? current.fixedAmount,
        skipExisting: saved.skipExisting ?? current.skipExisting,
        skipOutOfStock: saved.skipOutOfStock ?? current.skipOutOfStock,
        skipWithoutImages: saved.skipWithoutImages ?? current.skipWithoutImages,
        skipWithoutPrice: saved.skipWithoutPrice ?? current.skipWithoutPrice,
        minSourcePrice: saved.minSourcePrice === undefined ? current.minSourcePrice : String(saved.minSourcePrice),
        maxSourcePrice: saved.maxSourcePrice === undefined ? current.maxSourcePrice : String(saved.maxSourcePrice),
        minInventory: saved.minInventory === undefined ? current.minInventory : String(saved.minInventory),
        roundingMode: saved.roundingMode ?? current.roundingMode,
        roundingValue: saved.roundingValue === undefined ? current.roundingValue : String(saved.roundingValue),
        minSellingPrice: saved.minSellingPrice === undefined ? current.minSellingPrice : String(saved.minSellingPrice),
        maxSellingPrice: saved.maxSellingPrice === undefined ? current.maxSellingPrice : String(saved.maxSellingPrice),
        protectLockedPrice: saved.protectLockedPrice ?? current.protectLockedPrice,
        updatePrice: saved.updatePrice ?? current.updatePrice,
        importImages: saved.importImages ?? current.importImages,
        importDescriptions: saved.importDescriptions ?? current.importDescriptions,
        importInventory: saved.importInventory ?? current.importInventory,
      }));
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
    try { const r = await fetch('/api/admin/marketplaces', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({provider:'SHOPIFY'}) }); const j=await r.json(); if(!r.ok) throw new Error(j.error||'Sync failed.'); setMessage('Automatic sync complete: ' + (j.importedProducts ?? 0) + ' created, ' + (j.updatedProducts ?? 0) + ' updated, ' + (j.skippedProducts ?? 0) + ' skipped, ' + (j.failedProducts ?? 0) + ' failed.'); await load(); }
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

  const setRule = <K extends keyof typeof rules>(key: K, value: (typeof rules)[K]) => {
    setRules(current => ({ ...current, [key]: value }));
    setPreview([]);
  };

  const numeric = (value: string) => value.trim() === '' ? undefined : (Number.isFinite(Number(value)) ? Number(value) : undefined);

  const buildRules = () => ({
    mode: rules.mode,
    markupPercent: Number(rules.markupPercent) || 0,
    fixedAmount: Number(rules.fixedAmount) || 0,
    skipExisting: rules.skipExisting,
    skipOutOfStock: rules.skipOutOfStock,
    skipWithoutImages: rules.skipWithoutImages,
    skipWithoutPrice: rules.skipWithoutPrice,
    minSourcePrice: numeric(rules.minSourcePrice),
    maxSourcePrice: numeric(rules.maxSourcePrice),
    minInventory: numeric(rules.minInventory),
    roundingMode: rules.roundingMode,
    roundingValue: numeric(rules.roundingValue),
    minSellingPrice: numeric(rules.minSellingPrice),
    maxSellingPrice: numeric(rules.maxSellingPrice),
    protectLockedPrice: rules.protectLockedPrice,
    updatePrice: rules.updatePrice,
    importImages: rules.importImages,
    importDescriptions: rules.importDescriptions,
    importInventory: rules.importInventory,
  });

  const saveRules = async () => {
    const payload = buildRules();
    await update({ settings: payload });
    setMessage('Advanced import rules saved for automatic sync.');
  };

  const getIdsForImport = async () => {
    if (scope === 'selected') return selectedProducts;
    if (scope === 'collections') return products.map(p => p.id);
    const r = await fetch('/api/admin/marketplaces/shopify/products?scope=all&search=', { cache: 'no-store' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Unable to prepare all Shopify products.');
    return (j.products || []).map((p: Product) => p.id);
  };

  const previewImport = async () => {
    setLoadingCatalog(true); setError(''); setMessage('');
    try {
      const ids = await getIdsForImport();
      if (!ids.length) throw new Error('Select at least one product, or choose a collection/all products.');
      const r = await fetch('/api/admin/marketplaces/shopify/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: ids.slice(0, 100), preview: true, ...buildRules() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Preview failed.');
      setPreview(j.preview || []);
      setPreviewSummary(j.summary || { total: 0, create: 0, update: 0, skip: 0 });
      setMessage(ids.length > 100 ? 'Preview generated for the first 100 of ' + ids.length + ' products. The full selection will be imported in batches.' : 'Preview ready.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed.');
    } finally { setLoadingCatalog(false); }
  };

  const importProducts = async () => {
    setImporting(true); cancelRequested.current = false; setError(''); setMessage('');
    try {
      if (!preview.length) throw new Error('Generate a preview before importing.');
      const ids = await getIdsForImport();
      if (!ids.length) throw new Error('Select at least one product, or choose a collection/all products.');
      let created = 0, updated = 0, skipped = 0, failed = 0;
      for (let i = 0; i < ids.length; i += 100) {
        if (cancelRequested.current) break;
        const chunk = ids.slice(i, i + 100);
        const r = await fetch('/api/admin/marketplaces/shopify/import', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: chunk, ...buildRules() }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Import failed.');
        created += j.created || 0; updated += j.updated || 0; skipped += j.skipped || 0; failed += j.failed || 0;
        setMessage('Importing… ' + Math.min(i + 100, ids.length) + '/' + ids.length + ' | created ' + created + ', updated ' + updated + ', skipped ' + skipped + ', failed ' + failed);
      }
      setMessage(cancelRequested.current
        ? 'Stopped after the last completed batch. Created ' + created + ', updated ' + updated + ', skipped ' + skipped + '.'
        : 'Import complete: ' + created + ' created, ' + updated + ' updated, ' + skipped + ' skipped, ' + failed + ' failed.');
      setPreview([]);
      await loadCatalog(); await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally { setImporting(false); }
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
        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[.04] p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-400">3 · Import rules</p><h2 className="mt-1 text-xl font-black">Pricing, protection & filters</h2></div>
            <button onClick={saveRules} disabled={busy} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black">{busy?'Saving…':'Save for automatic sync'}</button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[10px] font-black uppercase text-slate-500">Mode<select value={rules.mode} onChange={e=>setRule('mode',e.target.value as ImportMode)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"><option value="CREATE_AND_UPDATE">Create + update</option><option value="CREATE_ONLY">Create only</option><option value="UPDATE_ONLY">Update only</option></select></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Markup %<input type="number" min="0" step=".1" value={rules.markupPercent} onChange={e=>setRule('markupPercent',Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"/></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Fixed amount<input type="number" min="0" value={rules.fixedAmount} onChange={e=>setRule('fixedAmount',Number(e.target.value))} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"/></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Rounding<select value={rules.roundingMode} onChange={e=>setRule('roundingMode',e.target.value as RoundingMode)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"><option value="NONE">No rounding</option><option value="NEAREST">Nearest</option><option value="UP">Round up</option><option value="DOWN">Round down</option></select></label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[10px] font-black uppercase text-slate-500">Rounding value<input value={rules.roundingValue} onChange={e=>setRule('roundingValue',e.target.value)} placeholder="10" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"/></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Source min<input value={rules.minSourcePrice} onChange={e=>setRule('minSourcePrice',e.target.value)} placeholder="No minimum" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"/></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Source max<input value={rules.maxSourcePrice} onChange={e=>setRule('maxSourcePrice',e.target.value)} placeholder="No maximum" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"/></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Min stock<input value={rules.minInventory} onChange={e=>setRule('minInventory',e.target.value)} placeholder="No minimum" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"/></label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-[10px] font-black uppercase text-slate-500">Selling price min<input value={rules.minSellingPrice} onChange={e=>setRule('minSellingPrice',e.target.value)} placeholder="No minimum" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"/></label>
            <label className="text-[10px] font-black uppercase text-slate-500">Selling price max<input value={rules.maxSellingPrice} onChange={e=>setRule('maxSellingPrice',e.target.value)} placeholder="No maximum" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm"/></label>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs"><input type="checkbox" checked={rules.skipExisting} onChange={e=>setRule('skipExisting',e.target.checked)}/><span>Skip already imported</span></label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs"><input type="checkbox" checked={rules.skipOutOfStock} onChange={e=>setRule('skipOutOfStock',e.target.checked)}/><span>Skip out-of-stock</span></label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs"><input type="checkbox" checked={rules.skipWithoutImages} onChange={e=>setRule('skipWithoutImages',e.target.checked)}/><span>Skip without usable images</span></label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs"><input type="checkbox" checked={rules.skipWithoutPrice} onChange={e=>setRule('skipWithoutPrice',e.target.checked)}/><span>Skip without source price</span></label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs"><input type="checkbox" checked={rules.protectLockedPrice} onChange={e=>setRule('protectLockedPrice',e.target.checked)}/><span>Protect locked prices</span></label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs"><input type="checkbox" checked={rules.updatePrice} onChange={e=>setRule('updatePrice',e.target.checked)}/><span>Update existing price</span></label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs"><input type="checkbox" checked={rules.importImages} onChange={e=>setRule('importImages',e.target.checked)}/><span>Import images</span></label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs"><input type="checkbox" checked={rules.importDescriptions} onChange={e=>setRule('importDescriptions',e.target.checked)}/><span>Import descriptions</span></label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs"><input type="checkbox" checked={rules.importInventory} onChange={e=>setRule('importInventory',e.target.checked)}/><span>Sync inventory</span></label>
          </div>
        </section>

        <section className="mt-5 rounded-3xl border border-indigo-400/20 bg-indigo-500/5 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-300">4 · Preview</p><h2 className="mt-1 text-xl font-black">Review before commit</h2><p className="mt-1 text-xs text-slate-500">The server calculates create/update/skip decisions and proposed prices.</p></div>
            <button onClick={previewImport} disabled={loadingCatalog || (scope==='selected'&&!selectedProducts.length)} className="rounded-2xl bg-white px-6 py-3 text-xs font-black text-slate-950 disabled:opacity-30">{loadingCatalog?'Working…':'Generate preview'}</button>
          </div>
          {preview.length>0&&<>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 p-4"><p className="text-[10px] uppercase text-slate-500">Previewed</p><p className="mt-1 text-xl font-black">{previewSummary.total}</p></div>
              <div className="rounded-2xl border border-emerald-400/20 p-4"><p className="text-[10px] uppercase text-emerald-300">Create</p><p className="mt-1 text-xl font-black">{previewSummary.create}</p></div>
              <div className="rounded-2xl border border-blue-400/20 p-4"><p className="text-[10px] uppercase text-blue-300">Update</p><p className="mt-1 text-xl font-black">{previewSummary.update}</p></div>
              <div className="rounded-2xl border border-amber-400/20 p-4"><p className="text-[10px] uppercase text-amber-300">Skip</p><p className="mt-1 text-xl font-black">{previewSummary.skip}</p></div>
            </div>
            <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
              <table className="min-w-[850px] w-full text-left text-xs">
                <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-3">Product</th><th className="p-3">Source</th><th className="p-3">Current</th><th className="p-3">Proposed</th><th className="p-3">Stock</th><th className="p-3">Images</th><th className="p-3">Decision</th></tr></thead>
                <tbody className="divide-y divide-white/10">{preview.slice(0,100).map(row=><tr key={row.externalId}><td className="max-w-xs p-3"><b className="block truncate">{row.title}</b>{row.lockedPrice&&<span className="text-[10px] text-amber-300">Price locked</span>}</td><td className="p-3">{row.sourceCost===null?'—':'₹'+row.sourceCost.toFixed(2)}</td><td className="p-3">{row.currentSellingPrice===null?'New':'₹'+row.currentSellingPrice.toFixed(2)}</td><td className="p-3 font-bold">₹{row.proposedSellingPrice.toFixed(2)}</td><td className="p-3">{row.inventory===null?'—':row.inventory}</td><td className="p-3">{row.imageCount} / {row.existingImages}</td><td className="p-3"><span className={row.action==='CREATE'?'text-emerald-300':row.action==='UPDATE'?'text-blue-300':'text-amber-300'}>{row.action}</span><p className="text-[10px] text-slate-500">{row.reason||'Will be imported'}</p></td></tr>)}</tbody>
              </table>
            </div>
          </>}
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[.04] p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-400">5 · Confirm & import</p><h2 className="mt-1 text-xl font-black">{scope==='selected'?selectedProducts.length:products.length} product(s)</h2><p className="mt-1 text-xs text-slate-500">Preview is required. The server validates the same rules again.</p></div>
            <div className="flex gap-2">
              {importing&&<button onClick={()=>{cancelRequested.current=true;}} className="rounded-xl border border-amber-400/20 px-4 py-3 text-xs font-black text-amber-300">Stop after batch</button>}
              <button onClick={importProducts} disabled={importing||!preview.length||(scope==='selected'&&!selectedProducts.length)} className="rounded-2xl bg-white px-6 py-3 text-xs font-black text-slate-950 disabled:opacity-30">{importing?'Importing…':'Confirm & import'}</button>
            </div>
          </div>
        </section>
      </>}
      <section className="mt-5 rounded-3xl border border-white/10 bg-white/[.03] p-5 sm:p-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-400">Automatic sync</p><h2 className="mt-1 text-xl font-black">Keep imported products updated</h2><p className="mt-2 text-xs leading-5 text-slate-500">This is separate from the controlled importer. Use it for future product/stock updates.</p></div><button onClick={sync} disabled={busy||!ready||!integration?.enabled} className="rounded-xl bg-white px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-30">{busy?'Working…':'Sync Shopify now'}</button></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="text-[10px] font-black uppercase text-slate-500">Markup %<input type="number" min="0" step=".1" value={settings.markupPercent??0} onChange={e=>update({settings:{...settings,markupPercent:Number(e.target.value)}})} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4"/></label><label className="text-[10px] font-black uppercase text-slate-500">Fixed amount<input type="number" min="0" value={settings.fixedAmount??0} onChange={e=>update({settings:{...settings,fixedAmount:Number(e.target.value)}})} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4"/></label><label className="text-[10px] font-black uppercase text-slate-500">Interval<select value={integration?.syncIntervalMinutes??1440} onChange={e=>update({syncIntervalMinutes:Number(e.target.value)})} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4"><option value="60">1 hour</option><option value="180">3 hours</option><option value="360">6 hours</option><option value="720">12 hours</option><option value="1440">Daily</option></select></label></div><label className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs"><span><b className="block">Automatic sync</b><span className="text-[10px] text-slate-500">Uses configured server cron.</span></span><input type="checkbox" checked={Boolean(integration?.autoSync)} disabled={busy||!integration?.enabled} onChange={e=>update({autoSync:e.target.checked})}/></label></section>
    </div></main>;
}
