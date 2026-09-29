'use client';

import { useEffect, useState } from 'react';

type Mode = 'SEARCH' | 'URL';

type Integration = {
  autoSync: boolean;
  importedProducts: number;
  settings: Record<string, any> | null;
  credentialsConfigured: boolean;
  scrapingAntUsage?: { remainingCredits: number | null };
};

export default function MeeshoAutoImport() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [mode, setMode] = useState<Mode>('SEARCH');
  const [keyword, setKeyword] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [count, setCount] = useState('5');
  const [markup, setMarkup] = useState('30');
  const [stock, setStock] = useState('10');
  const [autoSync, setAutoSync] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const r = await fetch('/api/admin/marketplaces', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to load Meesho importer.');
      const item = (j.integrations || []).find((x: any) => x.provider === 'MEESHO');
      setIntegration(item || null);
      const s = item?.settings || {};
      setKeyword(String(s.keywords || ''));
      setCount(String(Math.min(5, Math.max(1, Number(s.maxItemsPerSync ?? 5) || 5))));
      setMarkup(String(s.markupPercent ?? 30));
      setStock(String(Math.max(1, Number(s.defaultInventory ?? 10) || 10)));
      setAutoSync(Boolean(item?.autoSync));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Meesho importer.');
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (extra: Record<string, unknown> = {}) => {
    const r = await fetch('/api/admin/marketplaces', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'MEESHO',
        enabled: true,
        ...extra,
        settings: {
          ...(integration?.settings || {}),
          keywords: keyword.trim(),
          maxItemsPerSync: Math.max(1, Math.min(5, Number(count) || 5)),
          markupPercent: Math.max(0, Number(markup) || 0),
          defaultInventory: Math.max(1, Math.min(1000, Number(stock) || 10)),
          importImages: true,
          importDescriptions: true,
          importInventory: true,
          importStatus: 'ACTIVE',
          mode: 'CREATE_AND_UPDATE',
          skipExisting: false,
          skipWithoutImages: false,
          skipWithoutPrice: false,
          updatePrice: true,
          protectLockedPrice: true,
          shardCountPerRun: 1,
        },
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Unable to save Meesho settings.');
    setIntegration(j.integration);
  };

  const run = async () => {
    if (mode === 'SEARCH' && !keyword.trim()) return setError('Enter a keyword, for example: mobile accessories.');
    if (mode === 'URL' && !sourceUrl.trim()) return setError('Paste a Meesho product URL first.');

    setBusy(true);
    setMessage('');
    setError('');
    try {
      await save();
      const r = await fetch('/api/admin/marketplaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'MEESHO',
          sourceUrl: mode === 'URL' ? sourceUrl.trim() : undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Meesho import failed.');

      const scrape = j.scraping || {};
      const summary = 'Found ' + (j.found ?? 0)
        + ', imported ' + (j.importedProducts ?? 0)
        + ', updated ' + (j.updatedProducts ?? 0)
        + ', skipped ' + (j.skippedProducts ?? 0)
        + ', failed ' + (j.failedProducts ?? 0) + '.';
      const discovery = j.discoveryMethod ? ' Discovery: ' + j.discoveryMethod + '.' : '';
      const detail = Array.isArray(j.failureDetails) && j.failureDetails.length ? ' ' + j.failureDetails[0] : '';
      const credits = scrape.remainingCreditsAfterRun != null
        ? ' Credits left: ' + Number(scrape.remainingCreditsAfterRun).toLocaleString() + '.'
        : '';
      const text = summary + discovery + credits + detail;

      if ((j.importedProducts ?? 0) > 0) setMessage(text);
      else setError(text);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Meesho import failed.');
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    setAutoSync(enabled);
    setBusy(true);
    try {
      await save({ autoSync: enabled });
    } catch (e) {
      setAutoSync(!enabled);
      setError(e instanceof Error ? e.message : 'Unable to update auto import.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-slate-950 to-orange-500/10">
      <div className="border-b border-white/10 p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-pink-300">Meesho</p>
            <h2 className="mt-1 text-2xl font-black">Import to Zenvora</h2>
            <p className="mt-2 text-xs text-slate-400">Search the public catalogue or test one exact product URL.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={integration?.credentialsConfigured ? 'rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-300' : 'rounded-full bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-300'}>
              {integration?.credentialsConfigured ? 'SCRAPINGANT CONNECTED' : 'SCRAPINGANT NOT CONFIGURED'}
            </span>
            {integration?.scrapingAntUsage?.remainingCredits != null && (
              <span className="rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-black text-slate-400">
                {Number(integration.scrapingAntUsage.remainingCredits).toLocaleString()} credits
              </span>
            )}
          </div>
        </div>
        {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div>}
        {message && <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">{message}</div>}
      </div>

      <div className="p-5 sm:p-7">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1 sm:w-fit">
          <button type="button" onClick={() => setMode('SEARCH')} className={mode === 'SEARCH' ? 'rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950' : 'rounded-xl px-4 py-2.5 text-xs font-black text-slate-400'}>Keyword search</button>
          <button type="button" onClick={() => setMode('URL')} className={mode === 'URL' ? 'rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950' : 'rounded-xl px-4 py-2.5 text-xs font-black text-slate-400'}>Direct URL test</button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {mode === 'SEARCH' ? (
            <label className="text-[10px] font-black uppercase text-slate-500 sm:col-span-2">Keyword
              <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="mobile accessories" className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
            </label>
          ) : (
            <label className="text-[10px] font-black uppercase text-slate-500 sm:col-span-3">Meesho product URL
              <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://www.meesho.com/.../p/..." className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
            </label>
          )}
          {mode === 'SEARCH' && (
            <label className="text-[10px] font-black uppercase text-slate-500">Products (max 5)
              <input type="number" min="1" max="5" value={count} onChange={e => setCount(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
            </label>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[10px] font-black uppercase text-slate-500">Markup %
            <input type="number" min="0" value={markup} onChange={e => setMarkup(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
          </label>
          <label className="text-[10px] font-black uppercase text-slate-500">Default stock
            <input type="number" min="1" max="1000" value={stock} onChange={e => setStock(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button onClick={() => void run()} disabled={busy || !integration?.credentialsConfigured} className="rounded-2xl bg-white px-6 py-3 text-xs font-black text-slate-950 disabled:opacity-40">
            {busy ? 'Importing…' : mode === 'URL' ? 'Import this product' : 'Find & import'}
          </button>
          {mode === 'SEARCH' && (
            <label className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-xs">
              <input type="checkbox" checked={autoSync} disabled={busy || !integration?.credentialsConfigured} onChange={e => void toggleAuto(e.target.checked)} />
              Auto import
            </label>
          )}
        </div>

        <p className="mt-4 text-[10px] leading-5 text-slate-500">
          Search discovery uses Meesho HTML plus browser network responses; product pages are processed sequentially.
        </p>
      </div>
    </section>
  );
}
