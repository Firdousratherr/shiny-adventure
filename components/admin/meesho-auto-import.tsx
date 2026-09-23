'use client';

import { useEffect, useState } from 'react';

type Integration = {
  id: string;
  provider: string;
  enabled: boolean;
  autoSync: boolean;
  syncIntervalMinutes: number;
  lastSuccessAt: string | null;
  lastError: string | null;
  importedProducts: number;
  healthStatus: string;
  settings: Record<string, any> | null;
  credentialsConfigured: boolean;
};

export default function MeeshoAutoImport() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/marketplaces', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load Meesho settings.');
      setIntegration((data.integrations || []).find((x: Integration) => x.provider === 'MEESHO') || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Meesho settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const patch = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/marketplaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'MEESHO', ...payload }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save Meesho settings.');
      setIntegration(data.integration);
      setMessage('Meesho settings saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save settings.');
    } finally {
      setBusy(false);
    }
  };

  const syncNow = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/marketplaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'MEESHO' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Meesho sync failed.');
      setMessage('Meesho sync complete: ' + (data.importedProducts ?? 0) + ' imported/updated, ' + (data.failedProducts ?? 0) + ' failed.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Meesho sync failed.');
    } finally {
      setBusy(false);
    }
  };

  const settings = integration?.settings || {};
  const keywords = String(settings.keywords || '');
  const categories = String(settings.categories || '');

  return (
    <section className="mt-5 rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-white/[.03] to-orange-500/10 p-5 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-pink-300">Meesho</p>
          <h2 className="mt-1 text-2xl font-black">Automatic Product Import</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
            Zenvora discovers public Meesho catalogue products, filters them, applies your markup, and creates or updates them directly in the connected Shopify store.
          </p>
        </div>
        <span className={integration?.credentialsConfigured ? 'rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-300' : 'rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-amber-300'}>
          {integration?.credentialsConfigured ? 'READY' : 'SCRAPINGBEE KEY REQUIRED'}
        </span>
      </div>

      {error && <div role="alert" className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-300">{error}</div>}
      {message && <div role="status" className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-300">{message}</div>}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Keywords (optional)
          <input defaultValue={keywords} onBlur={e => patch({ settings: { ...settings, keywords: e.target.value } })} placeholder="kurti, saree, handbags" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-slate-100" />
          <span className="mt-1 block normal-case text-slate-600">Comma-separated words. Leave blank to allow all discovered products.</span>
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Category filter (optional)
          <input defaultValue={categories} onBlur={e => patch({ settings: { ...settings, categories: e.target.value } })} placeholder="women ethnic wear, home" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-slate-100" />
          <span className="mt-1 block normal-case text-slate-600">Matches the category path read from the product page.</span>
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Products per run
          <input type="number" min="1" max="50" defaultValue={settings.maxItemsPerSync ?? 10} onBlur={e => patch({ settings: { ...settings, maxItemsPerSync: Math.max(1, Math.min(50, Number(e.target.value) || 10)) } })} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-slate-100" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Sitemap shards per run
          <input type="number" min="1" max="5" defaultValue={settings.shardCountPerRun ?? 1} onBlur={e => patch({ settings: { ...settings, shardCountPerRun: Math.max(1, Math.min(5, Number(e.target.value) || 1)) } })} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-slate-100" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Markup %
          <input type="number" min="0" step="0.1" defaultValue={settings.markupPercent ?? 30} onBlur={e => patch({ settings: { ...settings, markupPercent: Number(e.target.value) || 0 } })} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-slate-100" />
        </label>
        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
          Fixed profit ₹
          <input type="number" min="0" defaultValue={settings.fixedAmount ?? 0} onBlur={e => patch({ settings: { ...settings, fixedAmount: Number(e.target.value) || 0 } })} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-slate-100" />
        </label>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs">
          <span><b className="block">Auto import</b><span className="text-[10px] text-slate-500">Runs from the server cron.</span></span>
          <input type="checkbox" checked={Boolean(integration?.autoSync)} disabled={busy || !integration?.credentialsConfigured} onChange={e => patch({ enabled: true, autoSync: e.target.checked })} />
        </label>
        <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs">
          <span><b className="block">Import images</b><span className="text-[10px] text-slate-500">Use Meesho product media as Shopify files.</span></span>
          <input type="checkbox" checked={settings.importImages !== false} onChange={e => patch({ settings: { ...settings, importImages: e.target.checked } })} />
        </label>
        <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs">
          <span><b className="block">Import descriptions</b><span className="text-[10px] text-slate-500">Copy public product attributes into Shopify.</span></span>
          <input type="checkbox" checked={settings.importDescriptions !== false} onChange={e => patch({ settings: { ...settings, importDescriptions: e.target.checked } })} />
        </label>
        <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-xs">
          <span><b className="block">Shopify status</b><span className="text-[10px] text-slate-500">Use Draft until you are happy with the importer.</span></span>
          <select value={settings.importStatus ?? 'DRAFT'} onChange={e => patch({ settings: { ...settings, importStatus: e.target.value } })} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs">
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
          </select>
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button onClick={syncNow} disabled={busy || loading || !integration?.credentialsConfigured} className="rounded-2xl bg-white px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-30">{busy ? 'Working…' : 'Run Meesho Sync Now'}</button>
        <span className="text-[10px] text-slate-500">Imported/updated: {integration?.importedProducts ?? 0} · Last success: {integration?.lastSuccessAt ? new Date(integration.lastSuccessAt).toLocaleString('en-IN') : 'Never'}</span>
      </div>
    </section>
  );
}
