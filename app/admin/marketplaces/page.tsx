'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Settings = {
  markupPercent?: number;
  fixedAmount?: number;
  maxItemsPerSync?: number;
  syncProducts?: boolean;
  syncOrders?: boolean;
  syncInventory?: boolean;
};

type Integration = {
  id: string;
  provider: 'SHOPIFY';
  enabled: boolean;
  autoSync: boolean;
  syncIntervalMinutes: number;
  lastSuccessAt: string | null;
  lastError: string | null;
  importedProducts: number;
  healthStatus: string;
  lastSyncDurationMs: number | null;
  settings: Settings | null;
  credentialsConfigured: boolean;
  capabilities: { products: boolean; orders: boolean; inventory: boolean; note: string };
};

const SHOPIFY_FIELDS = [
  { key: 'storeDomain', label: 'Store domain', placeholder: 'your-store.myshopify.com' },
  { key: 'clientId', label: 'Client ID', secret: true, placeholder: 'Shopify Dev Dashboard client ID' },
  { key: 'clientSecret', label: 'Client secret', secret: true, placeholder: 'Shopify Dev Dashboard client secret' },
] as const;

export default function MarketplacesPage() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [credentialFields, setCredentialFields] = useState<Record<string, boolean>>({});

  const loadCredentialStatus = async () => {
    try {
      const r = await fetch('/api/admin/marketplaces/credentials?provider=SHOPIFY', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setCredentialFields(j.fields || {});
    } catch {
      // Keep the main integration view usable if field metadata cannot be loaded.
    }
  };

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin/marketplaces', { cache: 'no-store' });
      const j = await r.json();
      if (r.status === 403) {
        setForbidden(true);
        return;
      }
      if (!r.ok) throw new Error(j.error || 'Unable to load Shopify integration.');
      const next = (j.integrations?.[0] ?? null) as Integration | null;
      setIntegration(next);
      setSettingsOpen(!next?.credentialsConfigured);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Shopify integration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([load(), loadCredentialStatus()]);
  }, []);

  const saveCredentials = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'SHOPIFY', credentials }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to connect Shopify.');
      setCredentials({});
      setCredentialFields(j.fields || {});
      setMessage(j.detail || ('Connected to ' + (j.shopName || 'Shopify') + '.'));
      setSettingsOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to connect Shopify.');
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'SHOPIFY' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Shopify connection test failed.');
      setMessage(j.detail || 'Shopify connection is healthy.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shopify connection test failed.');
    } finally {
      setBusy(false);
    }
  };

  const removeCredentials = async () => {
    if (!window.confirm('Remove the saved Shopify credentials and disconnect the store?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces/credentials?provider=SHOPIFY', { method: 'DELETE' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to remove Shopify credentials.');
      setCredentials({});
      setCredentialFields({});
      setMessage('Shopify credentials removed.');
      await load();
      setSettingsOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove Shopify credentials.');
    } finally {
      setBusy(false);
    }
  };

  const update = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'SHOPIFY', ...patch }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to update Shopify settings.');
      setIntegration(current => current ? {
        ...current,
        ...j.integration,
        credentialsConfigured: j.credentialsConfigured ?? current.credentialsConfigured,
        capabilities: j.capabilities ?? current.capabilities,
      } : current);
      if (j.warning) setMessage(j.warning);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update Shopify settings.');
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await fetch('/api/admin/marketplaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'SHOPIFY' }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Shopify sync failed.');
      setMessage('Shopify sync complete: ' + j.importedProducts + ' products imported in ' + j.duration + ' ms.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Shopify sync failed.');
    } finally {
      setBusy(false);
    }
  };

  if (forbidden) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <div className="mx-auto mt-20 max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-8 text-center">
          <h1 className="text-2xl font-black">Marketplace permission required</h1>
          <p className="mt-3 text-sm text-slate-400">Ask the Super Admin to grant the Marketplaces permission.</p>
          <Link href="/admin/dashboard" className="mt-6 inline-block rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">Back to dashboard</Link>
        </div>
      </main>
    );
  }

  const settings = integration?.settings || {};
  const ready = Boolean(integration?.credentialsConfigured);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between px-4 sm:px-6">
          <div>
            <Link href="/admin/dashboard" className="text-2xl font-black tracking-tight">zenvora<span className="text-indigo-400">.</span></Link>
            <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">Marketplace control</p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/marketplaces/history" className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300">History</Link><button onClick={load} disabled={loading || busy} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">Refresh</button>
            <Link href="/admin/dashboard" className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-950">Dashboard</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
        <section className="overflow-hidden rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-white/[0.04] to-indigo-500/10">
          <div className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Only integration</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Shopify</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Connect your Shopify store directly from this admin screen. Credentials are encrypted in the database, and Zenvora obtains the short-lived Admin API access token server-side when it needs one.</p>
              </div>
              <div className={ready ? 'inline-flex shrink-0 items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-300' : 'inline-flex shrink-0 items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-[10px] font-black uppercase text-amber-300'}>
                <span className={ready ? 'h-1.5 w-1.5 rounded-full bg-emerald-300' : 'h-1.5 w-1.5 rounded-full bg-amber-300'} />
                {ready ? 'Connected' : 'Setup required'}
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Products</p><p className="mt-1 text-xl font-black">{integration?.importedProducts ?? 0}</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Health</p><p className={integration?.healthStatus === 'ERROR' ? 'mt-1 text-xl font-black text-red-300' : 'mt-1 text-xl font-black text-emerald-300'}>{integration?.healthStatus ?? 'UNKNOWN'}</p></div>
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Last sync</p><p className="mt-1 text-sm font-bold">{integration?.lastSuccessAt ? new Date(integration.lastSuccessAt).toLocaleString('en-IN') : 'Never synced'}</p></div>
            </div>
          </div>
        </section>

        {error && <div role="alert" className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300">{error}</div>}
        {message && <div role="status" className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-300">{message}</div>}

        {loading ? (
          <div className="mt-7 rounded-3xl border border-white/10 bg-white/5 p-12 text-center text-sm text-slate-400">Loading Shopify…</div>
        ) : (
          <>
            <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
              <button onClick={() => setSettingsOpen(x => !x)} className="flex w-full items-center justify-between text-left">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Connection</p>
                  <h2 className="mt-1 text-xl font-black">{ready ? 'Shopify credentials saved' : 'Connect your Shopify store'}</h2>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black text-slate-400">{settingsOpen ? 'Hide' : 'Configure'}</span>
              </button>

              {settingsOpen && (
                <div className="mt-6">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {SHOPIFY_FIELDS.map(field => (
                      <label key={field.key} className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        {field.label} {credentialFields[field.key] && <span className="text-emerald-400">• saved</span>}
                        <input
                          type={'secret' in field && field.secret ? 'password' : 'text'}
                          autoComplete="off"
                          value={credentials[field.key] ?? ''}
                          onChange={e => setCredentials(current => ({ ...current, [field.key]: e.target.value }))}
                          placeholder={credentialFields[field.key] ? 'Saved — enter only to replace' : field.placeholder}
                          className="mt-1.5 h-12 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm normal-case tracking-normal text-white outline-none focus:border-indigo-400/50"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 rounded-2xl border border-indigo-400/10 bg-indigo-500/5 p-4 text-xs leading-5 text-slate-400">
                    <b className="text-slate-200">Important:</b> do not add Shopify Store Domain, Client ID, or Client Secret to Vercel for this setup. Enter them here. Zenvora stores them encrypted and requests the Shopify access token only when needed.
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={saveCredentials} disabled={busy} className="rounded-xl bg-indigo-500 px-5 py-3 text-xs font-black text-white disabled:opacity-40">{busy ? 'Connecting…' : 'Save & connect'}</button>
                    <button onClick={testConnection} disabled={busy || !ready} className="rounded-xl border border-white/10 px-5 py-3 text-xs font-black text-slate-200 disabled:opacity-30">Test connection</button>
                    <button onClick={removeCredentials} disabled={busy || !ready} className="rounded-xl border border-red-400/20 px-5 py-3 text-xs font-black text-red-300 disabled:opacity-30">Disconnect</button>
                  </div>
                  <p className="mt-3 text-[10px] leading-5 text-slate-600">Never paste Shopify secrets into GitHub, source code, screenshots, or chat.</p>
                </div>
              )}
            </section>

            <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-400">Synchronization</p>
                  <h2 className="mt-1 text-xl font-black">Product sync</h2>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{integration?.capabilities.note}. Products are imported into Zenvora using provider ID deduplication.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={async () => { setBusy(true); setError(''); setMessage(''); try { const r = await fetch('/api/admin/marketplaces/monitor', { method: 'POST' }); const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Source monitoring failed.'); const changes = (j.results || []).filter((x: { priceChanged?: boolean }) => x.priceChanged).length; setMessage('Source check complete: ' + j.checked + ' products checked' + (changes ? ', ' + changes + ' price change(s) detected.' : '.')); } catch (e) { setError(e instanceof Error ? e.message : 'Source monitoring failed.'); } finally { setBusy(false); } }} disabled={busy} className="rounded-xl border border-violet-400/30 bg-violet-500/10 px-5 py-3 text-xs font-black text-violet-200 disabled:opacity-30">Check source prices & stock</button>
                  <button onClick={sync} disabled={busy || !ready || !integration?.enabled} className="rounded-xl bg-white px-5 py-3 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-30">{busy ? 'Working…' : 'Sync Shopify now'}</button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Markup %
                  <input type="number" min="0" step="0.1" value={settings.markupPercent ?? 0} onChange={e => update({ settings: { ...settings, markupPercent: Number(e.target.value) } })} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm text-white" />
                </label>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Fixed amount
                  <input type="number" min="0" step="1" value={settings.fixedAmount ?? 0} onChange={e => update({ settings: { ...settings, fixedAmount: Number(e.target.value) } })} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm text-white" />
                </label>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Max products
                  <select value={settings.maxItemsPerSync ?? 100} onChange={e => update({ settings: { ...settings, maxItemsPerSync: Number(e.target.value) } })} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm text-white">
                    <option value="20">20</option><option value="50">50</option><option value="100">100</option><option value="250">250</option><option value="500">500</option>
                  </select>
                </label>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Sync interval
                  <select value={integration?.syncIntervalMinutes ?? 1440} onChange={e => update({ syncIntervalMinutes: Number(e.target.value) })} className="mt-1.5 h-11 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 text-sm text-white">
                    <option value="60">1 hour</option><option value="180">3 hours</option><option value="360">6 hours</option><option value="720">12 hours</option><option value="1440">Daily</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <label className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs"><span>Products</span><input type="checkbox" checked={Boolean(settings.syncProducts ?? true)} onChange={e => update({ settings: { ...settings, syncProducts: e.target.checked } })} /></label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs"><span>Orders</span><input type="checkbox" checked={Boolean(settings.syncOrders ?? true)} onChange={e => update({ settings: { ...settings, syncOrders: e.target.checked } })} /></label>
                <label className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs"><span>Inventory</span><input type="checkbox" checked={Boolean(settings.syncInventory ?? true)} onChange={e => update({ settings: { ...settings, syncInventory: e.target.checked } })} /></label>
              </div>

              <label className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3 text-xs">
                <span><b className="block">Automatic sync</b><span className="text-[10px] text-slate-500">Uses the configured server cron. Shopify must be connected and enabled.</span></span>
                <input type="checkbox" checked={Boolean(integration?.autoSync)} disabled={busy || !integration?.enabled} onChange={e => update({ autoSync: e.target.checked })} />
              </label>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
                <span>Connection: <b className={ready ? 'text-emerald-400' : 'text-amber-400'}>{ready ? 'READY' : 'SETUP REQUIRED'}</b></span>
                <span>Last duration: {integration?.lastSyncDurationMs ? integration.lastSyncDurationMs + ' ms' : '—'}</span>
              </div>
              {integration?.lastError && <div className="mt-4 rounded-2xl border border-red-400/10 bg-red-500/10 p-4 text-xs font-semibold text-red-300">{integration.lastError}</div>}
            </section>

            <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 text-xs leading-6 text-slate-500 sm:p-7">
              <h2 className="font-black text-slate-200">Shopify setup</h2>
              <p className="mt-2">Create/release the Shopify app in the Dev Dashboard, then enter the store domain, Client ID, and Client Secret above. For the client-credentials flow, the app and target store must belong to the same Shopify organization.</p>
              <p className="mt-2">Zenvora does not need a permanent Shopify access token in Vercel. It requests a short-lived Admin API token server-side when a connection test or sync runs.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
