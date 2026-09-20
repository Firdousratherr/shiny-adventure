'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Settings = {
  markupPercent?: number;
  fixedAmount?: number;
  maxItemsPerSync?: number;
  syncProducts?: boolean;
  syncOrders?: boolean;
  syncInventory?: boolean;
  query?: string;
};

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
  healthStatus: string;
  lastSyncDurationMs: number | null;
  settings: Settings | null;
  credentialsConfigured: boolean;
  capabilities: { products: boolean; orders: boolean; inventory: boolean; note: string };
};

const meta: Record<string, { name: string; description: string; tone: string }> = {
  AMAZON: { name: 'Amazon', description: 'Amazon Selling Partner API', tone: 'bg-orange-50 text-orange-700' },
  FLIPKART: { name: 'Flipkart', description: 'Marketplace Seller API v3', tone: 'bg-blue-50 text-blue-700' },
  MEESHO: { name: 'Meesho', description: 'Seller / partner integration', tone: 'bg-pink-50 text-pink-700' },
  EBAY: { name: 'eBay', description: 'Browse API catalog importer', tone: 'bg-indigo-50 text-indigo-700' },
  ETSY: { name: 'Etsy', description: 'Open API v3', tone: 'bg-red-50 text-red-700' },
  SHOPIFY: { name: 'Shopify', description: 'Admin GraphQL API', tone: 'bg-emerald-50 text-emerald-700' },
};

export default function MarketplacesPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [credentialFields, setCredentialFields] = useState<Record<string, boolean>>({});
  const [credentialBusy, setCredentialBusy] = useState(false);

  const credentialConfig: Record<string, { key: string; label: string; secret?: boolean; placeholder?: string }[]> = {
    AMAZON: [
      { key: 'clientId', label: 'Client ID', secret: true },
      { key: 'clientSecret', label: 'Client Secret', secret: true },
      { key: 'refreshToken', label: 'Refresh Token', secret: true },
      { key: 'region', label: 'Region', placeholder: 'eu' },
      { key: 'marketplaceId', label: 'Marketplace ID', placeholder: 'A21TJRUUN4KGV' },
    ],
    FLIPKART: [{ key: 'apiKey', label: 'API Key', secret: true }, { key: 'apiSecret', label: 'API Secret', secret: true }],
    MEESHO: [{ key: 'apiKey', label: 'Partner API Key', secret: true }, { key: 'apiSecret', label: 'Partner API Secret', secret: true }],
    EBAY: [
      { key: 'clientId', label: 'Client ID', secret: true },
      { key: 'clientSecret', label: 'Client Secret', secret: true },
      { key: 'environment', label: 'Environment', placeholder: 'production' },
      { key: 'marketplaceId', label: 'Marketplace ID', placeholder: 'EBAY-US' },
    ],
    ETSY: [
      { key: 'apiKeyString', label: 'API Keystring', secret: true },
      { key: 'sharedSecret', label: 'Shared Secret', secret: true },
      { key: 'accessToken', label: 'Access Token', secret: true },
      { key: 'shopId', label: 'Shop ID' },
    ],
    SHOPIFY: [
      { key: 'storeDomain', label: 'Store Domain', placeholder: 'your-store.myshopify.com' },
      { key: 'accessToken', label: 'Admin API Access Token', secret: true },
    ],
  };

  const loadCredentialStatus = async (provider: string) => {
    try {
      const r = await fetch(`/api/admin/marketplaces/credentials?provider=${encodeURIComponent(provider)}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setCredentialFields(j.fields || {});
    } catch { /* main marketplace state remains usable */ }
  };

  useEffect(() => {
    if (selected) {
      setCredentials({});
      setCredentialFields({});
      void loadCredentialStatus(selected);
    }
  }, [selected]);

  const saveCredentials = async (provider: string) => {
    setCredentialBusy(true); setError(''); setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, credentials }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to save credentials.');
      setCredentials({});
      setCredentialFields(j.fields || {});
      setMessage(`${meta[provider]?.name || provider}: credentials saved securely.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save credentials.');
    } finally { setCredentialBusy(false); }
  };

  const testCredentials = async (provider: string) => {
    setCredentialBusy(true); setError(''); setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Connection test failed.');
      setMessage(`${meta[provider]?.name || provider}: ${j.detail}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection test failed.');
    } finally { setCredentialBusy(false); }
  };

  const removeCredentials = async (provider: string) => {
    if (!window.confirm(`Remove saved ${meta[provider]?.name || provider} credentials and turn this integration OFF?`)) return;
    setCredentialBusy(true); setError(''); setMessage('');
    try {
      const r = await fetch(`/api/admin/marketplaces/credentials?provider=${encodeURIComponent(provider)}`, { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to remove credentials.');
      setCredentialFields({}); setCredentials({});
      setMessage(`${meta[provider]?.name || provider}: saved credentials removed.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove credentials.');
    } finally { setCredentialBusy(false); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/marketplaces', { cache: 'no-store' });
      const j = await r.json();
      if (r.status === 403) {
        setForbidden(true);
        return;
      }
      if (!r.ok) throw new Error(j.error || 'Unable to load marketplace settings.');
      setItems(j.integrations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load marketplace settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = async (provider: string, patch: Record<string, unknown>) => {
    setBusy(provider);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, ...patch }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Update failed.');
      setItems(x => x.map(i => i.provider === provider ? { ...i, ...j.integration, credentialsConfigured: j.credentialsConfigured ?? i.credentialsConfigured, capabilities: j.capabilities ?? i.capabilities } : i));
      if (j.warning) setMessage(j.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusy('');
    }
  };

  const sync = async (provider: string) => {
    setBusy(provider);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Sync failed.');
      setMessage(`${meta[provider]?.name || provider}: ${j.importedProducts} products imported in ${j.duration} ms.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setBusy('');
    }
  };

  const filtered = useMemo(() => items.filter(i => filter === 'ALL' || (filter === 'CONNECTED' ? i.credentialsConfigured : filter === 'ON' ? i.enabled : i.healthStatus === 'ERROR')), [items, filter]);
  const selectedItem = items.find(i => i.provider === selected);

  if (forbidden) return <main className="min-h-screen bg-slate-950 p-6 text-white"><div className="mx-auto mt-20 max-w-xl rounded-3xl bg-slate-900 p-8 text-center"><h1 className="text-2xl font-black">Marketplace permission required</h1><p className="mt-3 text-sm text-slate-400">Ask the Super Admin to grant the Marketplaces permission.</p><Link href="/admin/dashboard" className="mt-6 inline-block rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">Back to dashboard</Link></div></main>;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div><Link href="/admin/dashboard" className="text-2xl font-black tracking-tight">zenvora<span className="text-indigo-400">.</span></Link><p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Control center</p></div>
          <div className="flex gap-2"><button onClick={load} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300">Refresh</button><Link href="/admin/dashboard" className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950">Dashboard</Link></div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">Integrations</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Marketplace command center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Connect official marketplace APIs, control pricing, choose what gets imported, and monitor every synchronization from one place.</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-400"><b className="text-white">Rule:</b> no marketplace website scraping. Only official APIs or authorized partner access.</div>
        </div>

        {error && <div role="alert" className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
        {message && <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{message}</div>}

        <div className="mt-7 flex flex-wrap gap-2">
          {['ALL', 'CONNECTED', 'ON', 'ERROR'].map(x => <button key={x} onClick={() => setFilter(x)} className={`rounded-full px-4 py-2 text-xs font-black transition ${filter === x ? 'bg-white text-slate-950' : 'border border-white/10 bg-white/5 text-slate-400'}`}>{x}</button>)}
        </div>

        {loading ? <div className="mt-7 rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-sm text-slate-400">Loading integrations…</div> :
          <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(i => {
              const m = meta[i.provider] || { name: i.provider, description: 'Marketplace integration', tone: 'bg-slate-100 text-slate-700' };
              const s = i.settings || {};
              const working = busy === i.provider;
              return <article key={i.provider} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/10">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div><span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black uppercase ${m.tone}`}>{i.provider}</span><h2 className="mt-3 text-xl font-black">{m.name}</h2><p className="mt-1 text-xs text-slate-500">{m.description}</p></div>
                    <button aria-label={i.enabled ? 'Disable integration' : 'Enable integration'} disabled={working} onClick={() => update(i.provider, { enabled: !i.enabled })} className={`relative h-7 w-12 shrink-0 rounded-full ${i.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${i.enabled ? 'left-6' : 'left-1'}`} /></button>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] font-bold">
                    <div className="rounded-xl border border-white/10 bg-black/10 p-2.5"><span className="block text-slate-500">Connection</span><span className={i.credentialsConfigured ? 'text-emerald-400' : 'text-amber-400'}>{i.credentialsConfigured ? 'READY' : 'SETUP'}</span></div>
                    <div className="rounded-xl border border-white/10 bg-black/10 p-2.5"><span className="block text-slate-500">Health</span><span className={i.healthStatus === 'ERROR' ? 'text-red-400' : 'text-emerald-400'}>{i.healthStatus}</span></div>
                    <div className="rounded-xl border border-white/10 bg-black/10 p-2.5"><span className="block text-slate-500">Products</span><span className="text-white">{i.importedProducts}</span></div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                    <span className={i.capabilities.products ? 'text-emerald-400' : ''}>Products {i.capabilities.products ? '✓' : '—'}</span>
                    <span className={i.capabilities.orders ? 'text-emerald-400' : ''}>Orders {i.capabilities.orders ? '✓' : '—'}</span>
                    <span className={i.capabilities.inventory ? 'text-emerald-400' : ''}>Inventory {i.capabilities.inventory ? '✓' : '—'}</span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button disabled={working || !i.enabled || !i.credentialsConfigured || !i.capabilities.products} onClick={() => sync(i.provider)} className="h-11 flex-1 rounded-xl bg-white text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">{working ? 'Working…' : 'Sync now'}</button>
                    <button onClick={() => setSelected(selected === i.provider ? null : i.provider)} className="h-11 rounded-xl border border-white/10 px-4 text-xs font-black text-slate-300">{selected === i.provider ? 'Close' : 'Settings'}</button>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>{i.lastSuccessAt ? new Date(i.lastSuccessAt).toLocaleString('en-IN') : 'Never synced'}</span><span>{i.lastSyncDurationMs ? `${i.lastSyncDurationMs} ms` : ''}</span></div>
                  {i.lastError && <div className="mt-3 rounded-xl border border-red-400/10 bg-red-500/10 p-3 text-[10px] font-semibold text-red-300">{i.lastError}</div>}
                </div>

                {selected === i.provider && <div className="border-t border-white/10 bg-black/20 p-5">
                  <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="text-sm font-black">API credentials</h3><p className="mt-1 text-[10px] leading-5 text-slate-500">Enter credentials here. They are encrypted on the server and are never sent back to this page.</p></div>
                      <span className={i.credentialsConfigured ? 'rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black text-emerald-400' : 'rounded-full bg-amber-500/10 px-2.5 py-1 text-[9px] font-black text-amber-400'}>{i.credentialsConfigured ? 'CONNECTED' : 'NOT SET'}</span>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {(credentialConfig[i.provider] || []).map(field => (
                        <label key={field.key} className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          {field.label} {credentialFields[field.key] && <span className="text-emerald-400">• saved</span>}
                          <input
                            type={field.secret ? 'password' : 'text'}
                            autoComplete="off"
                            value={credentials[field.key] ?? ''}
                            onChange={e => setCredentials(x => ({ ...x, [field.key]: e.target.value }))}
                            placeholder={credentialFields[field.key] ? 'Saved — enter only to replace' : field.placeholder || ''}
                            className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm normal-case tracking-normal text-white outline-none focus:border-indigo-400/50"
                          />
                        </label>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button disabled={credentialBusy} onClick={() => saveCredentials(i.provider)} className="rounded-xl bg-indigo-500 px-4 py-2.5 text-[10px] font-black text-white disabled:opacity-40">{credentialBusy ? 'Working…' : 'Save securely'}</button>
                      <button disabled={credentialBusy || !i.credentialsConfigured} onClick={() => testCredentials(i.provider)} className="rounded-xl border border-white/10 px-4 py-2.5 text-[10px] font-black text-slate-200 disabled:opacity-30">Test connection</button>
                      <button disabled={credentialBusy || !i.credentialsConfigured} onClick={() => removeCredentials(i.provider)} className="rounded-xl border border-red-400/20 px-4 py-2.5 text-[10px] font-black text-red-300 disabled:opacity-30">Remove credentials</button>
                    </div>
                    <p className="mt-3 text-[9px] leading-4 text-slate-600">Never paste credentials into GitHub, source code, screenshots, or chat.</p>
                  </div>

                  <div className="mt-5">
                    <h3 className="text-sm font-black">Sync & pricing controls</h3>
                  <h3 className="text-sm font-black">Sync & pricing controls</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Markup %<input type="number" step="0.1" value={s.markupPercent ?? 0} onChange={e => update(i.provider, { settings: { ...s, markupPercent: Number(e.target.value) } })} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white" /></label>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Fixed amount<input type="number" step="1" value={s.fixedAmount ?? 0} onChange={e => update(i.provider, { settings: { ...s, fixedAmount: Number(e.target.value) } })} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white" /></label>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Max products<select value={s.maxItemsPerSync ?? 100} onChange={e => update(i.provider, { settings: { ...s, maxItemsPerSync: Number(e.target.value) } })} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white"><option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="250">250</option><option value="500">500</option></select></label>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Interval<select value={i.syncIntervalMinutes} onChange={e => update(i.provider, { syncIntervalMinutes: Number(e.target.value) })} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white"><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="180">3 hours</option><option value="360">6 hours</option><option value="720">12 hours</option><option value="1440">Daily</option></select></label>
                  </div>
                  <div className="mt-4 space-y-2">
                    {[['syncProducts', 'Import products'], ['syncOrders', 'Import orders'], ['syncInventory', 'Sync inventory']].map(([key, label]) => <label key={key} className="flex items-center justify-between rounded-xl border border-white/10 px-3 py-2.5 text-xs"><span>{label}</span><input type="checkbox" checked={Boolean(s[key as keyof Settings] ?? true)} disabled={!i.capabilities[key.replace('sync', '').toLowerCase() as keyof Integration['capabilities']]} onChange={e => update(i.provider, { settings: { ...s, [key]: e.target.checked } })} /></label>)}
                  </div>
                  {(i.provider === 'AMAZON' || i.provider === 'EBAY' || i.provider === 'SHOPIFY') && <label className="mt-4 block text-[10px] font-black uppercase tracking-wider text-slate-500">Import search / keyword (optional)<input value={s.query ?? ''} onChange={e => update(i.provider, { settings: { ...s, query: e.target.value } })} placeholder={i.provider === 'EBAY' ? 'e.g. wireless earbuds' : 'Optional keyword'} className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-white" /></label>}
                  <label className="mt-4 flex items-center justify-between rounded-xl border border-white/10 px-3 py-3 text-xs"><span><b className="block">Automatic sync</b><span className="text-[10px] text-slate-500">Vercel cron checks enabled integrations every 15 minutes.</span></span><input type="checkbox" checked={i.autoSync} disabled={!i.enabled} onChange={e => update(i.provider, { autoSync: e.target.checked })} /></label>
                  <p className="mt-4 text-[10px] leading-5 text-slate-500">{i.capabilities.note}. {i.credentialsConfigured ? 'Credentials detected.' : 'Required credentials are not configured yet.'}</p>
                </div>}
              </article>;
            })}
          </div>
        }

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h3 className="font-black">Safety controls</h3><p className="mt-2 text-xs leading-5 text-slate-500">Keep API credentials server-side, never expose secrets in browser code, and never use marketplace scraping as an API substitute.</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h3 className="font-black">Pricing engine</h3><p className="mt-2 text-xs leading-5 text-slate-500">Each provider can have its own markup and fixed fee. Your existing Pricing Rules system can remain the advanced override layer.</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5"><h3 className="font-black">Sync protection</h3><p className="mt-2 text-xs leading-5 text-slate-500">Imports use provider + external ID deduplication, sync-run history, health status, and failure messages so a failed marketplace does not stop the others.</p></div>
        </section>
      </div>
    </main>
  );
}
