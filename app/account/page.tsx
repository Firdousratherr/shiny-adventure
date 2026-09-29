import Link from 'next/link';
import { auth, signOut } from '../../auth';
import { db } from '../../lib/db';
import StoreHeader from '../../components/store-header';
import StoreFooter from '../../components/store-footer';

export default async function Account() {
  const session=await auth();
  if(session?.user?.role!=='customer') return (
    <main className="store-shell min-h-screen"><StoreHeader /><div className="store-container py-16"><div className="store-auth-card mx-auto max-w-lg text-center"><div className="store-auth-icon">◎</div><h1 className="mt-5 text-3xl font-black text-slate-950">Sign in to your account</h1><p className="mt-3 text-sm leading-6 text-slate-500">Access your orders, saved addresses and profile details.</p><Link href="/login" className="store-primary-btn mt-6">Sign in <span>→</span></Link></div></div><StoreFooter /></main>
  );
  const email=session.user.email??undefined;
  if(!email) return (
    <main className="store-shell min-h-screen"><StoreHeader /><div className="store-container py-16"><div className="store-auth-card mx-auto max-w-lg text-center"><div className="store-auth-icon">!</div><h1 className="mt-5 text-3xl font-black text-slate-950">Account unavailable</h1><p className="mt-3 text-sm leading-6 text-slate-500">Please sign in again to continue.</p><Link href="/login" className="store-primary-btn mt-6">Sign in <span>→</span></Link></div></div><StoreFooter /></main>
  );

  const customer=await db.customerUser.findUnique({where:{email},select:{name:true,email:true,createdAt:true}});
  const orders=await db.order.findMany({where:{email},orderBy:{createdAt:'desc'},take:10,select:{orderNumber:true,status:true,totalAmount:true,createdAt:true}});
  return (
    <main id="main-content" className="store-shell">
      <StoreHeader loggedIn />
      <div className="store-container pb-12 pt-7 sm:pt-10">
        <div className="grid gap-5 lg:grid-cols-[270px_1fr]">
          <aside className="store-account-sidebar">
            <div className="store-avatar">{(customer?.name||session.user.name||'C').slice(0,1).toUpperCase()}</div>
            <p className="mt-4 text-xl font-black text-slate-950">{customer?.name||session.user.name||'Customer'}</p>
            <p className="mt-1 break-all text-xs leading-5 text-slate-500">{customer?.email||email}</p>
            <nav className="mt-7 space-y-1">
              <Link href="/account" className="store-account-link is-active">Overview</Link>
              <Link href="/account/profile" className="store-account-link">Edit profile</Link>
              <Link href="/account/addresses" className="store-account-link">Saved addresses</Link>
              <Link href="/products" className="store-account-link">Continue shopping</Link>
            </nav>
            <form action={async()=>{'use server';await signOut({redirectTo:'/'})}} className="mt-5 border-t border-slate-200 pt-5"><button className="store-account-link w-full text-left text-rose-500">Sign out</button></form>
          </aside>
          <section>
            <div className="store-account-hero"><div><p className="store-kicker">Account overview</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Welcome back.</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Everything you need to keep track of your Zenvora orders in one place.</p></div><div className="store-account-hero-art" aria-hidden="true"><span>↗</span><small>Orders</small></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">{[['Orders',String(orders.length),'/account'],['Profile','Ready','/account/profile'],['Addresses','Saved','/account/addresses']].map(([label,value,href])=><Link key={label} href={href} className="store-account-stat"><span>{label}</span><strong>{value}</strong><small>Open →</small></Link>)}</div>
            <div className="store-panel mt-5">
              <div className="flex items-center justify-between gap-3"><div><p className="store-kicker">Recent activity</p><h2 className="mt-1 text-xl font-black text-slate-950">My orders</h2></div><Link href="/track" className="store-text-link">Track an order →</Link></div>
              {orders.length===0?<div className="store-empty mt-5 py-12"><div className="store-empty-icon">⌂</div><h3>No orders yet</h3><p>Your orders will appear here after checkout.</p><Link href="/products" className="store-primary-btn mt-5">Start shopping <span>→</span></Link></div>:<div className="mt-5 divide-y divide-slate-100">{orders.map(order=><div key={order.orderNumber} className="store-order-row"><div className="min-w-0"><p className="font-extrabold text-slate-900">#{order.orderNumber}</p><p className="mt-1 text-xs text-slate-400">{order.createdAt.toLocaleDateString('en-IN')}</p></div><span className="store-status">{order.status.replaceAll('_',' ')}</span><strong className="text-sm text-slate-950">₹{Number(order.totalAmount).toLocaleString('en-IN',{minimumFractionDigits:2})}</strong></div>)}</div>}
            </div>
          </section>
        </div>
      </div>
      <StoreFooter />
    </main>
  );
}
