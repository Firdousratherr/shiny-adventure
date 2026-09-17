import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import PaymentActions from './payment-actions';

export default async function AdminOrders() {
  const session = await auth();
  if (!session?.user?.email) redirect('/admin/login');
  const orders = await db.order.findMany({
    where: { status: 'PAYMENT_PENDING' },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
  });
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="container py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm text-slate-500">Admin</p><h1 className="text-3xl font-black">Payment verification</h1></div>
          <a href="/admin/dashboard" className="font-semibold">← Dashboard</a>
        </div>
        <div className="mt-8 space-y-5">
          {!orders.length && <div className="rounded-2xl bg-white p-8 text-center text-slate-500">No payments are waiting for verification.</div>}
          {orders.map((order) => (
            <section key={order.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <div className="flex flex-wrap justify-between gap-4">
                <div><h2 className="text-xl font-black">{order.orderNumber}</h2><p className="text-sm text-slate-500">{order.createdAt.toLocaleString('en-IN')}</p></div>
                <p className="text-2xl font-black">₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="mt-5 grid gap-2 text-sm md:grid-cols-2"><p><b>Customer:</b> {order.customerName}</p><p><b>Phone:</b> {order.phone}</p><p><b>UTR:</b> {order.upiTransactionId || 'Not submitted'}</p><p><b>Screenshot:</b> {order.paymentScreenshotUrl ? <a className="font-semibold underline" href={order.paymentScreenshotUrl}>Open proof</a> : 'Not submitted'}</p></div>
              <div className="mt-5 border-t pt-4">{order.items.map(i => <div key={i.id} className="flex justify-between gap-3 py-1 text-sm"><span>{i.productName} × {i.quantity}</span><span>₹{Number(i.unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>)}</div>
              <PaymentActions orderNumber={order.orderNumber} />
              {order.paymentRejectionReason && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Previous rejection: {order.paymentRejectionReason}</p>}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
