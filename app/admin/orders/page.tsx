import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import PaymentActions from './payment-actions';

const statuses = ['PAYMENT_PENDING','CONFIRMED','ORDERED_FROM_SOURCE','SHIPPED','DELIVERED','CANCELLED','RTO','RETURN_REQUESTED','REFUNDED'] as const;
const money = (v: unknown) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default async function AdminOrders({ searchParams }: { searchParams?: { status?: string; q?: string } }) {
  const session = await auth();
  if (!session?.user?.email) redirect('/admin/login');
  const status = statuses.includes(searchParams?.status as typeof statuses[number]) ? searchParams?.status : undefined;
  const q = (searchParams?.q || '').trim();
  const orders = await db.order.findMany({
    where: { ...(status ? { status: status as any } : {}), ...(q ? { OR: [{ orderNumber: { contains: q, mode: 'insensitive' } }, { customerName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}) },
    orderBy: { createdAt: 'desc' }, take: 100,
    include: { items: true },
  });
  return <main className="min-h-screen bg-slate-100"><div className="container py-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-500">Zenvora Admin</p><h1 className="text-3xl font-black">Order management</h1></div><Link href="/admin/dashboard" className="font-semibold">← Dashboard</Link></div>
    <form className="mt-6 flex flex-wrap gap-2"><input name="q" defaultValue={q} placeholder="Search order, customer or phone" className="min-w-[260px] flex-1 rounded-xl border bg-white px-4 py-3"/><select name="status" defaultValue={status || ''} className="rounded-xl border bg-white px-4 py-3"><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select><button className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white">Filter</button></form>
    <div className="mt-6 space-y-5">{!orders.length&&<div className="rounded-2xl bg-white p-8 text-center text-slate-500">No orders found.</div>}{orders.map(order=><section key={order.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-wrap justify-between gap-4"><div><h2 className="text-xl font-black">{order.orderNumber}</h2><p className="text-sm text-slate-500">{order.createdAt.toLocaleString('en-IN')}</p></div><div className="text-right"><p className="text-2xl font-black">{money(order.totalAmount)}</p><span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{order.status}</span></div></div>
      <div className="mt-5 grid gap-2 text-sm md:grid-cols-3"><p><b>Customer:</b> {order.customerName}</p><p><b>Phone:</b> {order.phone}</p><p><b>Payment:</b> {order.paymentMethod}</p><p><b>Address:</b> {order.addressLine1}, {order.city}, {order.state} - {order.pinCode}</p><p><b>UTR:</b> {order.upiTransactionId || '—'}</p><p><b>Source order:</b> {order.sourceOrderId || '—'}</p><p><b>Courier:</b> {order.courierName || '—'}</p><p><b>Tracking:</b> {order.trackingNumber || '—'}</p><p><b>Refund:</b> {order.refundAmount ? `${money(order.refundAmount)} · ${order.refundMethod || 'manual'}` : '—'}</p></div>
      <div className="mt-5 border-t pt-4">{order.items.map(i=><div key={i.id} className="flex justify-between gap-3 py-1 text-sm"><span>{i.productName} × {i.quantity}</span><span>{money(i.unitPrice)}</span></div>)}</div>
      {order.status==='PAYMENT_PENDING'&&<PaymentActions orderNumber={order.orderNumber}/>}<OrderActions orderNumber={order.orderNumber} status={order.status}/>
    </section>)}</div>
  </div></main>;
}

function OrderActions({ orderNumber, status }: { orderNumber: string; status: string }) {
  const show = ['CONFIRMED','ORDERED_FROM_SOURCE','SHIPPED','DELIVERED','RTO','RETURN_REQUESTED'].includes(status);
  if (!show) return null;
  return <div className="mt-5 border-t pt-5"><form action="/api/admin/orders/update" method="post" className="grid gap-3 md:grid-cols-4"><input type="hidden" name="orderNumber" value={orderNumber}/><select name="status" className="rounded-xl border px-3 py-3"><option value="">Change status…</option>{['ORDERED_FROM_SOURCE','SHIPPED','DELIVERED','CANCELLED','RTO','RETURN_REQUESTED','REFUNDED'].filter(s=>s!==status).map(s=><option key={s}>{s}</option>)}</select><input name="note" placeholder="Admin note / reason" className="rounded-xl border px-3 py-3"/><input name="sourceOrderId" placeholder="Source order ID (private)" className="rounded-xl border px-3 py-3"/><input name="courierName" placeholder="Courier" className="rounded-xl border px-3 py-3"/><input name="trackingNumber" placeholder="Tracking number" className="rounded-xl border px-3 py-3"/><input name="trackingUrl" placeholder="Tracking URL" className="rounded-xl border px-3 py-3"/><input name="refundAmount" placeholder="Refund amount ₹" inputMode="decimal" className="rounded-xl border px-3 py-3"/><input name="refundMethod" placeholder="Refund method" className="rounded-xl border px-3 py-3"/><input name="refundReference" placeholder="Refund reference" className="rounded-xl border px-3 py-3"/><button className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white md:col-span-4">Save order update</button></form></div>;
}