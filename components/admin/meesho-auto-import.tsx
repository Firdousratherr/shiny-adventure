'use client';

import { useEffect, useState } from 'react';

type Mode = 'SEARCH' | 'URL';

type Integration = {
  enabled: boolean;
  autoSync: boolean;
  importedProducts: number;
  lastSuccessAt: string | null;
  settings: Record<string, any> | null;
  credentialsConfigured: boolean;
  scrapingAntUsage?: {
    planName: string | null;
    totalCredits: number | null;
    remainingCredits: number | null;
  };
};

type RunResult = {
  found?: number;
  importedProducts?: number;
  updatedProducts?: number;
  skippedProducts?: number;
  failedProducts?: number;
  urlsScanned?: number;
  shardsScanned?: number;
  discoveryMethod?: string;
  failureDetails?: string[];
  duration?: number;
  scraping?: {
    remainingCreditsBeforeRun?: number | null;
    remainingCreditsAfterRun?: number | null;
    browserFallbacksUsed?: number;
    discoveryBrowserRequestUsed?: boolean;
  };
};

export default function MeeshoAutoImport() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [mode, setMode] = useState<Mode>('SEARCH');
  const [keyword, setKeyword] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [count, setCount] = useState('5');
  const [markup, setMarkup] = useState('30');
  const [defaultInventory, setDefaultInventory] = useState('10');
  const [autoSync, setAutoSync] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/admin/marketplaces', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to load Meesho importer.');
      const item = (j.integrations || []).find((x: any) => x.provider === 'MEESHO');
      setIntegration(item || null);
      const settings = item?.settings || {};
      setKeyword(String(settings.keywords || ''));
      setCount(String(Math.min(6, Math.max(1, Number(settings.maxItemsPerSync ?? 5) || 5))));
      setMarkup(String(settings.markupPercent ?? 30));
      setDefaultInventory(String(Math.max(1, Number(settings.defaultInventory ?? 10) || 10)));
      setAutoSync(Boolean(item?.autoSync));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Meesho importer.');
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (extra: Record<string, unknown> = {}) => {
    setError('');
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
          maxItemsPerSync: Math.max(1, Math.min(6, Number(count) || 5)),
          markupPercent: Math.max(0, Number(markup) || 0),
          defaultInventory: Math.max(1, Math.min(1000, Number(defaultInventory) || 10)),
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
    setBusy(true);
    setError('');
    setMessage('');
    setLastRun(null);

    try {
      if (mode === 'SEARCH' && !keyword.trim()) throw new Error('Enter a Meesho keyword first.');
      if (mode === 'URL' && !sourceUrl.trim()) throw new Error('Paste a Meesho product URL first.');

      setPhase(mode === 'URL' ? 'Reading the product page…' : 'Finding Meesho products…');
      await save();
      setPhase(mode === 'URL' ? 'Importing product…' : 'Reading product pages one by one…');

      const r = await fetch('/api/admin/marketplaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'MEESHO',
          sourceUrl: mode === 'URL' ? sourceUrl.trim() : undefined,
        }),
      });
      const j: RunResult & { error?: string } = await r.json();
      if (!r.ok) throw new Error(j.error || 'Meesho import failed.');

      setLastRun(j);
      const scrape = j.scraping || {};
      const summary = 'Found ' + (j.found ?? 0)
        + ', imported ' + (j.importedProducts ?? 0)
        + ', updated ' + (j.updatedProducts ?? 0)
        + ', skipped ' + (j.skippedProducts ?? 0)
        + ', failed ' + (j.failedProducts ?? 0) + '.';
      const credits = scrape.remainingCreditsAfterRun !== null && scrape.remainingCreditsAfterRun !== undefined
        ? ' ScrapingAnt: ' + Number(scrape.remainingCreditsAfterRun).toLocaleString() + ' credits left.'
        : '';
      const detail = Array.isArray(j.failureDetails) && j.failureDetails.length ? ' ' + j.failureDetails[0] : '';

      if ((j.importedProducts ?? 0) > 0) {
        setMessage(summary + credits + detail);
      } else {
        setError(summary + credits + detail);
      }
      setPhase('');
      await load();
    } catch (e) {
      setPhase('');
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

  const connected = Boolean(integration?.credentialsConfigured);
  const credits = integration?.scrapingAntUsage?.remainingCredits;

  return (
    <section className="mt-5 overflow-hidden rounded-3xl border border-pink-400/20 bg-gradient-to-br from-pink-500/10 via-slate-950 to-orange-500/10">
      <div className="border-b border-white/10 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-pink-300">Meesho importer</p>
            <h2 className="mt-1 text-2xl font-black">Import products to Zenvora</h2>
            <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-400">
              Search the public Meesho catalogue or paste one product URL. Dynamic pages are read with rendered browser requests and imported with images, description, category and your markup.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <span className={connected ? 'rounded-full bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black text-emerald-300' : 'rounded-full bg-red-500/10 px-3 py-1.5 text-[10px] font-black text-red-300'}>
              {connected ? 'SCRAPINGANT CONNECTED' : 'SCRAPINGANT NOT CONFIGURED'}
            </span>
            {credits !== null && credits !== undefined && (
              <span className="rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-black text-slate-400">
                {Number(credits).toLocaleString()} credits
              </span>
            )}
          </div>
        </div>

        {(error || message) && (
          <div className={(error ? 'border-red-400/20 bg-red-500/10 text-red-300' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300') + ' mt-5 rounded-2xl border px-4 py-3 text-xs leading-5'}>
            {error || message}
          </div>
        )}

        {busy && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[.03] px-4 py-3 text-xs text-slate-300">
            <span className="font-black text-white">{phase || 'Working…'}</span>
            <span className="ml-2 text-slate-500">Please keep this window open.</span>
          </div>
        )}
      </div>

      <div className="p-5 sm:p-7">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/70 p-1 sm:w-fit">
          <button type="button" onClick={() => setMode('SEARCH')} className={mode === 'SEARCH' ? 'rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950' : 'rounded-xl px-4 py-2.5 text-xs font-black text-slate-400'}>
            Keyword search
          </button>
          <button type="button" onClick={() => setMode('URL')} className={mode === 'URL' ? 'rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950' : 'rounded-xl px-4 py-2.5 text-xs font-black text-slate-400'}>
            Direct URL
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_150px_150px]">
          {mode === 'SEARCH' ? (
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Keyword
              <input
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                placeholder="mobile accessories"
                className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white outline-none focus:border-pink-400/50"
              />
            </label>
          ) : (
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500 lg:col-span-3">
              Meesho product URL
              <input
                value={sourceUrl}
                onChange={e => setSourceUrl(e.target.value)}
                placeholder="https://www.meesho.com/.../p/..."
                className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white outline-none focus:border-pink-400/50"
              />
            </label>
          )}

          {mode === 'SEARCH' && (
            <>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Products
                <input type="number" min="1" max="6" value={count} onChange={e => setCount(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
              </label>
              <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
                Markup %
                <input type="number" min="0" value={markup} onChange={e => setMarkup(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
              </label>
            </>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {mode === 'URL' && (
            <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
              Markup %
              <input type="number" min="0" value={markup} onChange={e => setMarkup(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
            </label>
          )}
          <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">
            Default stock
            <input type="number" min="1" max="1000" value={defaultInventory} onChange={e => setDefaultInventory(e.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm font-normal text-white" />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void run()}
            disabled={busy || !connected}
            className="rounded-2xl bg-white px-6 py-3 text-xs font-black text-slate-950 shadow-lg shadow-black/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Importing…' : mode === 'URL' ? 'Import this product' : 'Find & import products'}
          </button>

          {mode === 'SEARCH' && (
            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.02] px-4 py-3 text-xs text-slate-300">
              <input type="checkbox" checked={autoSync} disabled={busy || !connected} onChange={e => void toggleAuto(e.target.checked)} />
              Auto import
            </label>
          )}

          <span className="text-[10px] text-slate-500">Imported this run: {lastRun?.importedProducts ?? 0}</span>
        </div>

        {lastRun && (
          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3"><p className="text-[9px] font-black uppercase text-slate-500">Discovered</p><b className="mt-1 block text-lg">{lastRun.found ?? 0}</b></div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3"><p className="text-[9px] font-black uppercase text-slate-500">Imported</p><b className="mt-1 block text-lg text-emerald-300">{lastRun.importedProducts ?? 0}</b></div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3"><p className="text-[9px] font-black uppercase text-slate-500">Skipped</p><b className="mt-1 block text-lg text-amber-300">{lastRun.skippedProducts ?? 0}</b></div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3"><p className="text-[9px] font-black uppercase text-slate-500">Failed</p><b className="mt-1 block text-lg text-red-300">{lastRun.failedProducts ?? 0}</b></div>
          </div>
        )}

        <p className="mt-4 text-[10px] leading-5 text-slate-500">
          Search imports run sequentially to avoid scraper concurrency errors. Direct URL mode is the fastest way to test a known Meesho product.
        </p>
      </div>
    </section>
  );
}
