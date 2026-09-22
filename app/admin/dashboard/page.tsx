import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import AdminNav from '../../../components/admin-nav';

export default async function Dashboard(){
  const session=await auth(); if(session?.user?.role!=='admin')redirect('/admin/login');
  const since=new Date(Date.now()-30*24*60*60*1000);
  const [orders,pending,confirmed,shipped,products,lowStock,revenue,support,priceChanges,alerts,goals]=await Promise.all([
    db.order.count({where:{deletedAt:null}}),
    db.order.count({where:{status:'PAYMENT_PENDING',deletedAt:null}}),
    db.order.count({where:{status:'CONFIRMED',deletedAt:null}}),
    db.order.count({where:{status:'SHIPPED',deletedAt:null}}),
    db.product.count(),
    db.product.count({where:{status:'ACTIVE',stock:{lte:5}}}),
    db.order.aggregate({where:{createdAt:{gte:since},deletedAt:null,status:{in:['CONFIRMED','ORDERED_FROM_SOURCE','SHIPPED','DELIVERED']}},_sum:{totalAmount:true}}),
    db.supportTicket.count({where:{status:{not:'CLOSED'}}}),
    db.marketplacePriceChange.count({where:{acknowledged:false}}),
    db.stockAlert.count({where:{notifiedAt:null}}),
    db.businessGoal.findMany({where:{periodStart:{lte:new Date()},periodEnd:{gte:new Date()}},take:3})
  ]);

  const gross=Number(revenue._sum.totalAmount||0);
  const cards=[['Orders',orders,'/admin/orders'],['Pending payment',pending,'/admin/orders?status=PAYMENT_PENDING'],['Products',products,'/admin/products'],['Low stock',lowStock,'/admin/inventory']];
  const attention=[['Payment review',pending,'/admin/orders?status=PAYMENT_PENDING','red'],['Support tickets',support,'/admin/support','violet'],['Supplier price changes',priceChanges,'/admin/marketplaces/history','amber'],['Stock alerts',alerts,'/admin/inventory','blue']];

  function goalCurrent(metric:string){
    const key=metric.toLowerCase();
    if(key.includes('revenue')||key.includes('sales')||key.includes('gmv')) return gross;
    if(key.includes('order')) return orders;
    if(key.includes('product')) return products;
    return 0;
  }

  return <main className="min-h-screen bg-slate-100">
    <AdminNav active="dashboard"/>
    <div className="container py-7 md:py-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-violet-400">Overview</p>
          <h1 className="mt-1 text-3xl font-black sm:text-4xl">Store command center</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Welcome back, {session.user.email}. Here is what needs attention.</p>
        </div>
        <div className="text-right"><p className="text-xs text-slate-500">Last 30 days revenue</p><p className="text-2xl font-black">₹{gross.toLocaleString('en-IN',{minimumFractionDigits:2})}</p></div>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label,value,href])=><Link href={href as string} key={label as string} className="zenvora-card p-5">
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black">{value}</p>
          <p className="mt-3 text-xs font-bold text-violet-300">Open →</p>
        </Link>)}
      </div>

      <section className="mt-7">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-widest text-red-300">Live queue</p><h2 className="mt-1 text-xl font-black">Needs attention</h2></div>
          <Link href="/admin/operations" className="text-sm font-bold text-violet-300 hover:text-violet-200">Open Operations Center →</Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {attention.map(([label,value,href,tone])=><Link href={href as string} key={label as string} className="zenvora-card p-5">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold">{label}</span><span className={`h-2.5 w-2.5 rounded-full ${
              tone==='red'?'bg-red-400':tone==='amber'?'bg-amber-400':tone==='blue'?'bg-blue-400':'bg-violet-400'
            }`}/></div>
            <p className="mt-3 text-3xl font-black">{value}</p>
            <p className="mt-1 text-xs text-slate-500">items waiting</p>
          </Link>)}
        </div>
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="zenvora-card p-5">
          <div><p className="text-xs font-black uppercase tracking-widest text-violet-400">Operations</p><h2 className="mt-1 text-xl font-black">Quick actions</h2></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Link href="/admin/products" className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[.06]"><b>Manage products</b><p className="mt-1 text-xs text-slate-500">Catalog, pricing, SEO and bulk actions.</p></Link>
            <Link href="/admin/product-health" className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[.06]"><b>Product Health</b><p className="mt-1 text-xs text-slate-500">Find missing content, margin and inventory issues.</p></Link>
            <Link href="/admin/duplicate-detector" className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[.06]"><b>Duplicate Detector</b><p className="mt-1 text-xs text-slate-500">Catch duplicate names and source URLs.</p></Link>
            <Link href="/admin/marketplaces" className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[.06]"><b>Marketplace Center</b><p className="mt-1 text-xs text-slate-500">Shopify sync and source monitoring.</p></Link>
            <Link href="/admin/analytics" className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[.06]"><b>Business analytics</b><p className="mt-1 text-xs text-slate-500">Revenue, profit, margins and products.</p></Link>
            <Link href="/admin/automation" className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[.06]"><b>Automation</b><p className="mt-1 text-xs text-slate-500">Event-driven operational rules.</p></Link>
          </div>
        </section>

        <section className="zenvora-card p-5">
          <p className="text-xs font-black uppercase tracking-widest text-violet-400">Targets</p>
          <h2 className="mt-1 text-xl font-black">Business goals</h2>
          <div className="mt-4 space-y-5">
            {!goals.length&&<p className="text-sm text-slate-500">No active goals. <Link className="text-violet-300" href="/admin/goals">Create one →</Link></p>}
            {goals.map(g=>{
              const target=Number(g.target||0);
              const current=goalCurrent(g.metric);
              const progress=target>0?Math.max(0,Math.min(100,(current/target)*100)):0;
              return <div key={g.id}>
                <div className="flex items-end justify-between gap-3"><div><b>{g.name}</b><p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{g.metric}</p></div><span className="text-xs font-bold text-slate-300">{Math.round(progress)}%</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all" style={{width:`${progress}%`}}/></div>
                <p className="mt-1 flex justify-between gap-3 text-[10px] text-slate-500"><span>Current: {g.metric.toLowerCase().includes('revenue')||g.metric.toLowerCase().includes('sales')||g.metric.toLowerCase().includes('gmv') ? `₹${current.toLocaleString('en-IN',{minimumFractionDigits:0})}` : current.toLocaleString('en-IN')}</span><span>Target: {g.metric.toLowerCase().includes('revenue')||g.metric.toLowerCase().includes('sales')||g.metric.toLowerCase().includes('gmv') ? `₹${target.toLocaleString('en-IN',{minimumFractionDigits:0})}` : target.toLocaleString('en-IN')}</span></p>
              </div>;
            })}
          </div>
        </section>
      </div>
    </div>
  </main>;
}
