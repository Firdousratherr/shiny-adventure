'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import MeeshoAutoImport from '../../../components/admin/meesho-auto-import';

type ShopifyProduct = {
  id: string;
  title: string;
  imageUrl: string | null;
  price: number;
  inventory: number;
  productType: string;
  vendor: string;
  imported: boolean;
};

type Integration = {
  id: string;
  provider: string;
  enabled: boolean;
  autoSync: boolean;
  importedProducts: number;
  lastSuccessAt: string | null;
  settings: Record<string, any> | null;
  credentialsConfigured: boolean;
};

export default function MarketplacesPage() {
  const [shopify, setShopify] = useState<Integration | null>(null);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [markup, setMarkup] = useState('0');
  const [autoSync, setAutoSync] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/admin/marketplaces', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to load marketplaces.');
      const item = (j.integrations || []).find((x: Integration) => x.provider === 'SHOPIFY');
      setShopify(item || null);
      setAutoSync(Boolean(item?.autoSync));
      setMarkup(String(item?.settings?.markupPercent ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load marketplaces.');
    }
  };

  const loadProducts = async () => {
    setBusy(true); setError('');
    try {
      const params = new URLSearchParams({ scope: 'all', search: '' });
      const r = await fetch('/api/admin/marketplaces/shopify/products?' + params.toString(), { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to load Shopify products.');
      setProducts(j.products || []);
      setSelected([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Shopify products.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (shopify?.credentialsConfigured) void loadProducts(); }, [shopify?.credentialsConfigured]);

  const visible = useMemo(() => products.filter(p => !search || p.title.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const allSelected = visible.length > 0 && visible.every(p => selected.includes(p.id));

  const updateShopify = async (extra: Record<string, unknown> = {}) => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/marketplaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'SHOPIFY',
          enabled: true,
          ...extra,
          settings: {
            ...(shopify?.settings || {}),
            markupPercent: Math.max(0, Number(markup) || 0),
            importImages: true,
            importDescriptions: true,
            importInventory: true,
            mode: 'CREATE_AND_UPDATE',
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to update Shopify.');
      setShopify(j.integration);
    } finally {
      setBusy(false);
    }
  };

  const importProducts = async () => {
    if (!selected.length) return setError('Select at least one Shopify product.');
    const ids = selected.slice(0, 100);
    setBusy(true); setError(''); setMessage('');
    try {
      await updateShopify();
      const r = await fetch('/api/admin/marketplaces/shopify/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: ids,
          markupPercent: Math.max(0, Number(markup) || 0),
          fixedAmount: 0,
          mode: 'CREATE_AND_UPDATE',
          importImages: true,
          importDescriptions: true,
          importInventory: true,
          skipWithoutImages: false,
          skipWithoutPrice: false,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Shopify import failed.');
      setMessage(`Imported ${j.created ?? 0} new, updated ${j.updated ?? 0}, skipped ${j.skipped ?? 0}.`);
      await loadProducts();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shopify import failed.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    setAutoSync(enabled);
    try {
      await updateShopify({ autoSync: enabled });
    } catch (e) {
      setAutoSync(!enabled);
      setError(e instanceof Error ? e.message : 'Unable to update auto sync.');
    }
  };

  if (!shopify?.credentialsConfigured && shopify) {
    // Keep the same compact UI but clearly state what is missing.
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <div><Link href="/admin/dashboard" className="text-xl font-black">zenvora<span className="text-indigo-400">.</span></Link><p className="text-[9px] font-black uppercase tracking-[.2em] text-slate-500">Product import</p></div>
          <Link href="/admin/dashboard" className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950">Dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-5 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-indigo-300">Shopify</p>
              <h1 className="mt-1 text-2xl font-black">Import to Zenvora</h1>
              <p className="mt-2 text-xs text-slate-400">Choose products from Shopify and add them to your Zenvora store.</p>
            </div>
            <span className={shopify?.credentialsConfigured ? 'rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-300' : 'rounded-full bg-amber-500/10 px-3 py-1.5 text-[10px] font-black text-amber-300'}>
              {shopify?.credentialsConfigured ? 'CONNECTED' : 'CONNECT SHOPIFY'}
            </span>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div>}
          {message && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">{message}</div>}

          {shopify?.credentialsConfigured && (
            <>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…" className="h-11 flex-1 rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm" />
                <button onClick={() => void loadProducts()} disabled={busy} className="rounded-2xl border border-white/10 px-5 py-2 text-xs font-black">{busy ? 'Loading…' : 'Refresh products'}</button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/50 p-4">
                <button onClick={() => setSelected(allSelected ? [] : visible.slice(0, 100).map(p => p.id))} className="text-xs font-black">{allSelected ? 'Deselect all' : 'Select all visible'}</button>
                <div className="flex items-center gap-2 text-xs"><span className="text-slate-500">Selected</span><b>{selected.length}</b></div>
              </div>

              <div className="mt-3 space-y-2">
                {visible.slice(0, 100).map(product => (
                  <label key={product.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/30 p-3">
                    <input type="checkbox" checked={selected.includes(product.id)} onChange={e => setSelected(v => e.target.checked ? Array.from(new Set([...v, product.id])) : v.filter(id => id !== product.id))} />
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-800">{product.imageUrl && <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
                    <div className="min-w-0 flex-1"><b className="block truncate text-sm">{product.title}</b><span className="text-[10px] text-slate-500">{product.productType || 'Product'} · ₹{product.price.toFixed(2)} · Stock {product.inventory}</span></div>
                    {product.imported && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-black text-emerald-300">IMPORTED</span>}
                  </label>
                ))}
                {!visible.length && <div className="rounded-2xl border border-white/10 p-8 text-center text-xs text-slate-500">No Shopify products found.</div>}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label className="text-[10px] font-black uppercase text-slate-500">Markup %
                  <input type="number" min="0" value={markup} onChange={e => setMarkup(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
                </label>
                <div className="flex items-end gap-2">
                  <button onClick={() => void importProducts()} disabled={busy || !selected.length} className="rounded-2xl bg-white px-6 py-3 text-xs font-black text-slate-950 disabled:opacity-40">{busy ? 'Importing…' : 'Import selected'}</button>
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-xs"><input type="checkbox" checked={autoSync} disabled={busy} onChange={e => void toggleAuto(e.target.checked)} /> Auto update</label>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">Images, descriptions and stock are imported automatically.</p>
            </>
          )}
        </section>

        <MeeshoAutoImport />
      </div>
    </main>
  );
}
