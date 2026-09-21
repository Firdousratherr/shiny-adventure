import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav from '../../../../components/admin-nav';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';

export default async function MarketplaceHistoryPage() {
  const admin = await requireAdminPermission('marketplaces');
  if (!admin) redirect('/admin/login');

  const [imports, changes] = await Promise.all([
    db.marketplaceImportLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { integration: { select: { provider: true } } },
    }),
    db.marketplacePriceChange.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { marketplaceProduct: { select: { title: true, sourceUrl: true } } },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <AdminNav active="marketplaces" />
      <div className="container py-6 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-violet-400">Marketplace operations</p>
            <h1 className="mt-1 text-3xl font-black">Import & price history</h1>
            <p className="mt-2 text-sm text-slate-400">Recent imports and source-price changes detected by monitoring.</p>
          </div>
          <Link href="/admin/marketplaces" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold">← Marketplaces</Link>
        </div>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-5"><h2 className="font-black">Recent imports</h2></div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400"><tr><th className="p-3">Time</th><th className="p-3">Source</th><th className="p-3">Product</th><th className="p-3">Cost</th><th className="p-3">Selling</th><th className="p-3">Mode</th><th className="p-3">Status</th></tr></thead>
              <tbody className="divide-y divide-white/10">{imports.map(x => <tr key={x.id}><td className="p-3 text-slate-400">{x.createdAt.toLocaleString('en-IN')}</td><td className="p-3 font-bold">{x.integration.provider.replace('_MANUAL','')}</td><td className="max-w-xs p-3">{x.title || x.externalId}</td><td className="p-3">₹{x.sourceCost?.toFixed(2) || '—'}</td><td className="p-3">₹{x.sellingPrice?.toFixed(2) || '—'}</td><td className="p-3">{x.automatic ? 'Automatic' : 'Manual'}</td><td className="p-3">{x.status}</td></tr>)}</tbody>
            </table>
            {!imports.length && <p className="p-6 text-sm text-slate-500">No imports recorded yet.</p>}
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="border-b border-white/10 p-5"><h2 className="font-black">Source price changes</h2></div>
          <div className="divide-y divide-white/10">{changes.map(x => <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-bold">{x.marketplaceProduct.title}</p><p className="text-xs text-slate-500">{x.createdAt.toLocaleString('en-IN')}</p></div><p className="font-black">₹{x.previousCost.toFixed(2)} → ₹{x.currentCost.toFixed(2)}</p></div>)}{!changes.length && <p className="p-6 text-sm text-slate-500">No source price changes detected yet.</p>}</div>
        </section>
      </div>
    </main>
  );
}
