'use client';

import { useEffect, useState } from 'react';

type Integration = {
  autoSync: boolean;
  importedProducts: number;
  lastSuccessAt: string | null;
  settings: Record<string, any> | null;
  credentialsConfigured: boolean;
};

export default function MeeshoAutoImport() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [keyword, setKeyword] = useState('');
  const [count, setCount] = useState('10');
  const [markup, setMarkup] = useState('30');
  const [autoSync, setAutoSync] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/admin/marketplaces', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to load Meesho.');
      const item = (j.integrations || []).find((x: any) => x.provider === 'MEESHO');
      setIntegration(item || null);
      const s = item?.settings || {};
      setKeyword(String(s.keywords || ''));
      setCount(String(s.maxItemsPerSync ?? 10));
      setMarkup(String(s.markupPercent ?? 30));
      setAutoSync(Boolean(item?.autoSync));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Meesho.');
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (extra: Record<string, unknown> = {}) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'MEESHO',
          enabled: true,
          ...extra,
          settings: {
            ...(integration?.settings || {}),
            keywords: keyword,
            maxItemsPerSync: Math.max(1, Math.min(50, Number(count) || 10)),
            markupPercent: Math.max(0, Number(markup) || 0),
            importImages: true,
            importDescriptions: true,
            importStatus: 'ACTIVE',
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to save Meesho settings.');
      setIntegration(j.integration);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      await save();
      const r = await fetch('/api/admin/marketplaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'MEESHO' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Meesho import failed.');
      const summary = `Found ${j.found ?? 0}, imported ${j.importedProducts ?? 0}, skipped ${j.skippedProducts ?? 0}, failed ${j.failedProducts ?? 0}.`;
      const detail = Array.isArray(j.failureDetails) && j.failureDetails.length ? ` ${j.failureDetails[0]}` : '';
      if (!j.importedProducts && j.failedProducts) setError(summary + detail);
      else setMessage(summary + detail);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Meesho import failed.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    setAutoSync(enabled);
    try {
      await save({ autoSync: enabled });
    } catch (e) {
      setAutoSync(!enabled);
      setError(e instanceof Error ? e.message : 'Unable to update auto import.');
    }
  };

  return (
    <section className="mt-5 rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-white/[.03] to-orange-500/10 p-5 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.2em] text-pink-300">Meesho</p>
          <h2 className="mt-1 text-2xl font-black">Import to Zenvora</h2>
          <p className="mt-2 text-xs text-slate-400">Find public Meesho products and add them directly to your website.</p>
        </div>
        <span className={integration?.credentialsConfigured ? 'rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-300' : 'rounded-full bg-amber-500/10 px-3 py-1.5 text-[10px] font-black text-amber-300'}>
          {integration?.credentialsConfigured ? 'READY' : 'ADD SCRAPINGBEE KEY'}
        </span>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div>}
      {message && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">{message}</div>}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="text-[10px] font-black uppercase text-slate-500">Keyword
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="e.g. mobile accessories" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
        </label>
        <label className="text-[10px] font-black uppercase text-slate-500">Products
          <input type="number" min="1" max="50" value={count} onChange={e => setCount(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
        </label>
        <label className="text-[10px] font-black uppercase text-slate-500">Markup %
          <input type="number" min="0" value={markup} onChange={e => setMarkup(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={run} disabled={busy || !integration?.credentialsConfigured} className="rounded-2xl bg-white px-5 py-3 text-xs font-black text-slate-950 disabled:opacity-40">
          {busy ? 'Importing…' : 'Import to Zenvora'}
        </button>
        <label className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-xs">
          <input type="checkbox" checked={autoSync} disabled={busy || !integration?.credentialsConfigured} onChange={e => void toggleAuto(e.target.checked)} />
          Auto import
        </label>
        <span className="text-[10px] text-slate-500">Imported: {integration?.importedProducts ?? 0}</span>
      </div>
    </section>
  );
}
