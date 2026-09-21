import Link from 'next/link';
import AdminNav from '../../../components/admin-nav';
import { redirect } from 'next/navigation';
import { requireAdminPermission } from '../../../lib/admin-access';
import { db } from '../../../lib/db';

export default async function NotificationsPage() {
  const admin = await requireAdminPermission('orders');
  if (!admin) redirect('/admin/login');
  const items = await db.adminNotification.findMany({ where: { dismissedAt: null }, orderBy: { createdAt: 'desc' }, take: 100 });
  return <main className="min-h-screen bg-slate-100"><AdminNav active="notifications"/><div className="container py-8">
    <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-indigo-600">Operations</p><h1 className="text-3xl font-black">Notification center</h1></div><Link href="/admin/dashboard" className="font-semibold">← Dashboard</Link></div>
    <div className="mt-6 space-y-3">{!items.length && <div className="rounded-2xl bg-white p-8 text-center text-slate-500">No active notifications.</div>}{items.map(n=><article key={n.id} className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ${n.readAt ? 'ring-slate-100' : 'ring-indigo-200'}`}><div className="flex flex-wrap justify-between gap-3"><div><span className="text-xs font-bold uppercase tracking-wider text-indigo-600">{n.type}</span><h2 className="mt-1 text-lg font-black">{n.title}</h2><p className="mt-1 text-sm text-slate-600">{n.message}</p></div><div className="text-right text-xs text-slate-500">{n.createdAt.toLocaleString('en-IN')}<div className="mt-2 flex gap-2 justify-end"><form action="/api/admin/notifications" method="post"><input type="hidden" name="id" value={n.id}/><button className="rounded-lg border px-3 py-2 font-bold">{n.readAt ? 'Read' : 'Mark read'}</button></form><form action="/api/admin/notifications" method="post"><input type="hidden" name="id" value={n.id}/><input type="hidden" name="action" value="dismiss"/><button className="rounded-lg border px-3 py-2 font-bold">Dismiss</button></form></div></div></div></article>)}</div>
  </div></main>;
}
