import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import AdminNav from '../../../components/admin-nav';

export default async function Dashboard() {
  const session = await auth();
  if (session?.user?.role !== 'admin') redirect('/admin/login');

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [orders, pending, confirmed, shipped, products, lowStock, revenue, support, priceChanges, alerts, goals] = await Promise.all([
    db.order.count({ where: { deletedAt: null } }),
    db.order.count({ where: { status: 'PAYMENT_PENDING', deletedAt: null } }),
    db.order.count({ where: { status: 'CONFIRMED', deletedAt: null } }),
    db.order.count({ where: { status: 'SHIPPED', deletedAt: null } }),
    db.product.count(),
    db.product.count({ where: { status: 'ACTIVE', stock: { lte: 5 } } }),
    db.order.aggregate({ where: { createdAt: { gte: since }, deletedAt: null, status: { in: ['CONFIRMED', 'ORDERED_FROM_SOURCE', 'SHIPPED', 'DELIVERED'] } }, _sum: { totalAmount: true } }),
    db.supportTicket.count({ where: { status: { not: 'CLOSED' } } }),
    db.marketplacePriceChange.count({ where: { acknowledged: false } }),
    db.stockAlert.count({ where: { notifiedAt: null } }),
    db.businessGoal.findMany({ where: { periodStart: { lte: new Date() }, periodEnd: { gte: new Date() } }, take: 3 }),
  ]);

  const gross = Number(revenue._sum.totalAmount || 0);
  const cards = [
    ['Orders', orders, '/admin/orders', 'Total orders'],
    ['Pending payment', pending, '/admin/orders?status=PAYMENT_PENDING', 'Needs review'],
    ['Products', products, '/admin/products', 'Catalog items'],
    ['Low stock', lowStock, '/admin/inventory', 'Inventory alerts'],
  ] as const;

  const attention = [
    ['Payment review', pending, '/admin/orders?status=PAYMENT_PENDING', 'rose'],
    ['Support tickets', support, '/admin/support', 'violet'],
    ['Supplier price changes', priceChanges, '/admin/marketplaces/history', 'amber'],
    ['Stock alerts', alerts, '/admin/inventory', 'cyan'],
  ] as const;

  function goalCurrent(metric: string) {
    const key = metric.toLowerCase();
    if (key.includes('revenue') || key.includes('sales') || key.includes('gmv')) return gross;
    if (key.includes('order')) return orders;
    if (key.includes('product')) return products;
    return 0;
  }

  return (
    <main className="admin-dark min-h-screen text-slate-900">
      <AdminNav active="dashboard" />

      <div className="container py-6 md:py-9 lg:ml-[272px]">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#171047] via-[#4325a7] to-[#8b3fe5] p-6 text-white shadow-2xl shadow-violet-500/15 sm:p-9">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="absolute bottom-[-90px] left-[34%] h-48 w-48 rounded-full bg-cyan-300/15 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-violet-100">Admin command center</span>
              <h1 className="mt-4 max-w-2xl text-3xl font-black tracking-[-.045em] sm:text-5xl">Your store, at a glance.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-violet-100/80">Welcome back, {session.user.email}. The dashboard surfaces the queues, catalog health and growth signals that matter most.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Link href="/admin/products" className="rounded-full bg-white px-4 py-2.5 text-xs font-black text-violet-800 shadow-lg hover:-translate-y-0.5">Manage products →</Link>
                <Link href="/admin/operations" className="rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-black text-white hover:bg-white/15">Open operations</Link>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-black/10 p-5 backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-200">30-day revenue</p>
              <p className="mt-2 text-3xl font-black sm:text-4xl">₹{gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              <p className="mt-1 text-xs text-violet-100/65">Confirmed through delivered orders</p>
            </div>
          </div>
        </section>

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(([label, value, href, detail], index) => (
            <Link href={href} key={label} className="admin-kpi-card relative overflow-hidden p-5">
              <div className="absolute right-[-16px] top-[-20px] h-20 w-20 rounded-full bg-violet-100/80 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[.12em] text-slate-500">{label}</p>
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-violet-50 text-xs font-black text-violet-700">0{index + 1}</span>
                </div>
                <p className="mt-4 text-3xl font-black tracking-tight text-slate-900">{value}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-[10px] text-slate-400">{detail}</span>
                  <span className="text-xs font-black text-violet-700">Open →</span>
                </div>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-fuchsia-600">Live queue</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Needs attention</h2>
            </div>
            <Link href="/admin/operations" className="text-xs font-black text-violet-700 hover:text-violet-900">Open Operations Center →</Link>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {attention.map(([label, value, href, tone]) => {
              const toneClass =
                tone === 'rose' ? 'bg-rose-500' :
                tone === 'amber' ? 'bg-amber-500' :
                tone === 'cyan' ? 'bg-cyan-500' : 'bg-violet-500';
              return (
                <Link href={href} key={label} className="zenvora-card group rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-extrabold text-slate-800">{label}</span>
                    <span className={'h-2.5 w-2.5 rounded-full ' + toneClass} />
                  </div>
                  <p className="mt-4 text-3xl font-black text-slate-900">{value}</p>
                  <p className="mt-1 text-xs text-slate-400">items waiting · open queue →</p>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <section className="admin-panel p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">Operations</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">Quick actions</h2>
              </div>
              <Link href="/admin/operations" className="text-xs font-black text-violet-700">All tools →</Link>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ['/admin/products', 'Manage products', 'Catalog, pricing, SEO and bulk actions.'],
                ['/admin/product-health', 'Product Health', 'Find missing content, margin and inventory issues.'],
                ['/admin/duplicate-detector', 'Duplicate Detector', 'Catch duplicate names and source URLs.'],
                ['/admin/marketplaces', 'Marketplace Center', 'Shopify sync and source monitoring.'],
                ['/admin/analytics', 'Business analytics', 'Revenue, profit, margins and products.'],
                ['/admin/automation', 'Automation', 'Event-driven operational rules.'],
              ].map(([href, title, description], index) => (
                <Link key={href} href={href} className="group rounded-2xl border border-slate-200 bg-slate-50/70 p-4 hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50/50">
                  <div className="flex items-center justify-between gap-3">
                    <b className="text-sm text-slate-900">{title}</b>
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[10px] font-black text-violet-700 shadow-sm">{index + 1}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="admin-panel p-5 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-600">Growth</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">Business goals</h2>
            <div className="mt-5 space-y-5">
              {!goals.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  No active goals. <Link className="font-black text-violet-700" href="/admin/goals">Create one →</Link>
                </div>
              ) : null}
              {goals.map((goal) => {
                const target = Number(goal.target || 0);
                const current = goalCurrent(goal.metric);
                const progress = target > 0 ? Math.max(0, Math.min(100, (current / target) * 100)) : 0;
                const money = goal.metric.toLowerCase().includes('revenue') || goal.metric.toLowerCase().includes('sales') || goal.metric.toLowerCase().includes('gmv');
                return (
                  <div key={goal.id}>
                    <div className="flex items-end justify-between gap-3">
                      <div><b className="text-sm text-slate-900">{goal.name}</b><p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">{goal.metric}</p></div>
                      <span className="text-xs font-black text-violet-700">{Math.round(progress)}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-cyan-400 transition-all" style={{ width: progress + '%' }} /></div>
                    <p className="mt-1 flex justify-between gap-3 text-[10px] text-slate-400">
                      <span>Current: {money ? '₹' + current.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : current.toLocaleString('en-IN')}</span>
                      <span>Target: {money ? '₹' + target.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : target.toLocaleString('en-IN')}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
