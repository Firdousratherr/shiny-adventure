import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav from '../../../components/admin-nav';
import { requireAdminPermission } from '../../../lib/admin-access';
import { db } from '../../../lib/db';

export default async function SystemHealthPage() {
  const admin = await requireAdminPermission('settings');
  if (!admin) redirect('/admin/login');

  let database = false;
  try { await db.$queryRawUnsafe('SELECT 1'); database = true; } catch {}

  const shopify = await db.marketplaceIntegration.findUnique({ where: { provider: 'SHOPIFY' }, select: { enabled: true, healthStatus: true, lastError: true } });
  const checks = [
    { name: 'Database', ok: database, detail: database ? 'Connected' : 'Database query failed' },
    { name: 'Razorpay', ok: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET), detail: process.env.RAZORPAY_KEY_ID ? 'Server credentials configured' : 'Server credentials missing' },
    { name: 'Email', ok: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS), detail: process.env.SMTP_HOST ? 'SMTP configured' : 'SMTP credentials missing' },
    { name: 'Vercel Blob', ok: Boolean(process.env.BLOB_READ_WRITE_TOKEN), detail: process.env.BLOB_READ_WRITE_TOKEN ? 'Storage configured' : 'BLOB_READ_WRITE_TOKEN missing' },
    { name: 'Rate limiting', ok: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN), detail: process.env.UPSTASH_REDIS_REST_URL ? 'Upstash Redis configured' : 'Rate limiting backend missing' },
    { name: 'Marketplace scraper', ok: Boolean(process.env.SCRAPINGBEE_API_KEY), detail: process.env.SCRAPINGBEE_API_KEY ? 'Automatic fallback configured' : 'Manual fallback only' },
    { name: 'Shopify', ok: shopify?.healthStatus === 'HEALTHY', detail: shopify?.enabled ? (shopify.lastError || shopify.healthStatus) : 'Not connected' },
  ];

  return <main className="min-h-screen bg-slate-950 text-white"><AdminNav active="settings"/><div className="container py-7 sm:py-10"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-emerald-400">Operations</p><h1 className="mt-1 text-3xl font-black">System health</h1><p className="mt-2 text-sm text-slate-400">Configuration checks without exposing secret values.</p></div><Link href="/admin/dashboard" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-bold">← Dashboard</Link></div><div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{checks.map(c=><article key={c.name} className="rounded-2xl border border-white/10 bg-white/5 p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-black">{c.name}</h2><span className={c.ok?'rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300':'rounded-full bg-amber-400/10 px-2.5 py-1 text-[10px] font-black text-amber-300'}>{c.ok?'HEALTHY':'CHECK'}</span></div><p className="mt-3 text-sm text-slate-400">{c.detail}</p></article>)}</div></div></main>;
}
