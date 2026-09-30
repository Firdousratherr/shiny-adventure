import Link from 'next/link';
import { auth, signOut } from '../../auth';
import { db } from '../../lib/db';
import StoreHeader from '../../components/store-header';
import AccountMenu from '../../components/account-menu';

export default async function Account() {
  const session = await auth();

  if (session?.user?.role !== 'customer') {
    return (
      <main className="store-dark min-h-screen">
        <StoreHeader />
        <div className="container py-16">
          <div className="zenvora-empty-state mx-auto max-w-lg">
            <div className="text-5xl">◉</div>
            <h1 className="mt-5 text-2xl font-black">Your account is waiting</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to view your orders, profile and saved addresses.</p>
            <Link href="/login" className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 font-black text-slate-950">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  const email = session.user.email ?? undefined;
  if (!email) {
    return (
      <main className="store-dark min-h-screen bg-[#070b16] text-white">
        <StoreHeader />
        <div className="container py-16">
          <div className="zenvora-empty-state mx-auto max-w-lg">
            <h1 className="text-2xl font-black">Account unavailable</h1>
            <p className="mt-3 text-sm text-slate-500">Your current session is missing an email address. Please sign in again.</p>
            <Link href="/login" className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 font-black text-slate-950">Sign in</Link>
          </div>
        </div>
      </main>
    );
  }

  const [customer, orders] = await Promise.all([
    db.customerUser.findUnique({ where: { email }, select: { name: true, email: true, createdAt: true } }),
    db.order.findMany({ where: { email }, orderBy: { createdAt: 'desc' }, take: 10, select: { orderNumber: true, status: true, totalAmount: true, createdAt: true } }),
  ]);

  return (
    <main className="store-dark min-h-screen pb-28 sm:pb-10">
      <StoreHeader loggedIn />

      <div className="container py-7 sm:py-10">
        <div className="zenvora-page-hero">
          <div>
            <span className="inline-flex rounded-full border bg-violet-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-violet-700">My Zenvora</span>
            <h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-5xl">Welcome back, {customer?.name || session.user.name || 'Customer'}.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Manage your details, saved addresses and recent orders from one place.</p>
          </div>
          <div className="hidden sm:block">
            <form action={async () => { 'use server'; await signOut({ redirectTo: '/' }); }}>
              <button className="zenvora-account-signout-hero" type="submit">Sign out</button>
            </form>
          </div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[250px_1fr]">
          <aside className="zenvora-account-nav">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-lg font-black shadow-lg shadow-violet-950/30">
              {(customer?.name || session.user.name || 'C').slice(0, 1).toUpperCase()}
            </div>
            <p className="mt-4 text-lg font-black">{customer?.name || session.user.name || 'Customer'}</p>
            <p className="mt-1 break-all text-xs text-slate-500">{customer?.email || email}</p>

            <div className="mt-6 sm:hidden">
              <AccountMenu signOutAction={async () => { 'use server'; await signOut({ redirectTo: '/' }); }} />
            </div>
            <nav className="mt-6 hidden space-y-1 sm:block">
              <Link href="/account" className="zenvora-account-link-active">Overview <span>→</span></Link>
              <Link href="/account/profile" className="zenvora-account-link">Edit profile <span>→</span></Link>
              <Link href="/account/addresses" className="zenvora-account-link">Saved addresses <span>→</span></Link>
              <Link href="/products" className="zenvora-account-link">Continue shopping <span>→</span></Link>
            </nav>
          </aside>

          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="zenvora-account-stat"><span>Orders</span><strong>{orders.length}</strong><small>recent orders shown</small></div>
              <div className="zenvora-account-stat"><span>Account</span><strong>Active</strong><small>customer account</small></div>
              <div className="zenvora-account-stat"><span>Member since</span><strong>{customer?.createdAt ? customer.createdAt.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}</strong><small>with Zenvora</small></div>
            </div>

            <section className="zenvora-account-panel">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-400">Purchase history</p>
                  <h2 className="mt-1 text-xl font-black">Recent orders</h2>
                </div>
                <Link href="/track" className="text-xs font-black text-violet-700 hover:text-fuchsia-600">Track an order →</Link>
              </div>

              {orders.length === 0 ? (
                <div className="zenvora-empty-state mt-6 py-12">
                  <div className="text-4xl">📦</div>
                  <p className="mt-4 font-black">No orders yet</p>
                  <p className="mt-2 text-sm text-slate-500">Your purchases will appear here after checkout.</p>
                  <Link href="/products" className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-xs font-black text-slate-950">Start shopping</Link>
                </div>
              ) : (
                <div className="mt-5 space-y-2">
                  {orders.map((order) => (
                    <div key={order.orderNumber} className="zenvora-order-row">
                      <div className="min-w-0">
                        <p className="font-black">#{order.orderNumber}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{order.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <span className="w-fit rounded-full border bg-violet-50 px-3 py-1 text-[10px] font-black text-violet-700">{order.status.replaceAll('_', ' ')}</span>
                      <p className="font-black">₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </section>
        </div>
      </div>
    </main>
  );
}
