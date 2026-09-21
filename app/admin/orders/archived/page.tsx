import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminNav from '../../../../components/admin-nav';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';
export default async function ArchivedOrders() {
  const admin = await requireAdminPermission('orders');
  if (!admin) redirect('/admin/login');
  const orders = await db.order.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' }, take: 200, select: { orderNumber:true, customerName:true, totalAmount:true, status:true, deletedAt:true } });
  return <main className="min-h-screen bg-slate-100"><AdminNav active="orders"/><div className="container py-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Order archive</p><h1 className="text-3xl font-black">Archived orders</h1></div><Link href="/admin/orders" className="font-semibold">← Active orders</Link></div><div className="mt-6 space-y-3">{!orders.length&&<div className="rounded-2xl bg-white p-8 text-center text-slate-500">No archived orders.</div>}{orders.map(o=><article key={o.orderNumber} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm"><div><h2 className="font-black">{o.orderNumber}</h2><p className="text-sm text-slate-500">{o.customerName} · {o.status} · archived {o.deletedAt?.toLocaleString('en-IN')}</p></div><div className="flex items-center gap-3"><strong>₹{Number(o.totalAmount).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong><form action="/api/admin/orders/restore" method="post"><input type="hidden" name="orderNumber" value={o.orderNumber}/><button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">Restore</button></form></div></article>)}</div></div></main>;
}