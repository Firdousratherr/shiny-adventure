'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import AdminCommandPalette from './admin-command-palette';

type Active = 'dashboard'|'operations'|'products'|'inventory'|'analytics'|'pricing'|'coupons'|'banners'|'orders'|'customers'|'settings'|'staff'|'approvals'|'marketplaces'|'audit'|'support'|'notifications'|'suppliers'|'reviews'|'automation'|'features'|'goals'|'integrations';

const groups = [
  { title: 'Overview', items: [['dashboard','Dashboard','/admin/dashboard'],['operations','Operations Center','/admin/operations']] },
  { title: 'Commerce', items: [['orders','Orders','/admin/orders'],['products','Products','/admin/products'],['inventory','Inventory','/admin/inventory'],['customers','Customers','/admin/customers']] },
  { title: 'Growth', items: [['pricing','Pricing','/admin/pricing'],['coupons','Coupons','/admin/coupons'],['banners','Storefront','/admin/banners']] },
  { title: 'Channels', items: [['marketplaces','Marketplace Center','/admin/marketplaces'],['suppliers','Suppliers','/admin/suppliers']] },
  { title: 'Customer Care', items: [['support','Support','/admin/support'],['notifications','Notifications','/admin/notifications'],['reviews','Reviews','/admin/reviews']] },
  { title: 'Insights', items: [['analytics','Analytics','/admin/analytics'],['goals','Business Goals','/admin/goals']] },
  { title: 'System', items: [['automation','Automation Rules','/admin/automation'],['features','Feature Flags','/admin/feature-flags'],['integrations','Integration Events','/admin/integration-events'],['staff','Staff & Access','/admin/staff'],['approvals','Approvals','/admin/approvals'],['audit','Activity Log','/admin/audit'],['settings','Settings','/admin/settings']] },
] as const;

export default function AdminNav({ active }: { active: Active }) {
  const [open,setOpen]=useState(false);
  return <>
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-white/10 bg-[#090e1d]/95 text-white backdrop-blur-2xl lg:flex">
      <div className="flex h-20 items-center border-b border-white/10 px-5">
        <Link href="/admin/dashboard" className="text-2xl font-black tracking-tight">zenvora<span className="text-fuchsia-400">.</span><span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] uppercase tracking-[.18em] text-slate-400">Admin</span></Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map(group=><div key={group.title} className="mb-5">
          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">{group.title}</p>
          <nav className="space-y-1">{group.items.map(([key,label,href])=><Link key={key} href={href} className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-bold transition ${active===key?'bg-white text-slate-950 shadow-lg shadow-white/10':'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{label}</Link>)}</nav>
        </div>)}
      </div>
      <div className="space-y-2 border-t border-white/10 p-3">
        <Link href="/" className="block rounded-xl bg-violet-500/10 px-3 py-2.5 text-sm font-bold text-violet-300">View Store →</Link>
        <button type="button" onClick={()=>signOut({callbackUrl:'/admin/login'})} className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm font-bold text-slate-300 hover:bg-white/10">Sign out</button>
      </div>
    </aside>

    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090e1d]/90 text-white backdrop-blur-2xl lg:ml-64">
      <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
        <button type="button" aria-label="Open admin menu" onClick={()=>setOpen(true)} className="rounded-xl border border-white/10 px-3 py-2 lg:hidden">☰</button>
        <div className="min-w-0 flex-1">
          <AdminCommandPalette />
        </div>
        <Link href="/admin/notifications" className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold">🔔</Link>
        <Link href="/" className="hidden rounded-xl bg-violet-500/10 px-3 py-2 text-sm font-bold text-violet-300 sm:block">Store</Link>
      </div>
    </header>

    {open&&<div className="fixed inset-0 z-[60] lg:hidden">
      <button aria-label="Close menu" className="absolute inset-0 bg-black/70" onClick={()=>setOpen(false)}/>
      <aside className="relative flex h-full w-[min(86vw,320px)] flex-col overflow-y-auto border-r border-white/10 bg-[#090e1d] p-3 text-white shadow-2xl">
        <div className="flex items-center justify-between px-2 py-3"><b className="text-xl">zenvora<span className="text-fuchsia-400">.</span></b><button onClick={()=>setOpen(false)} className="rounded-xl border border-white/10 px-3 py-2">×</button></div>
        {groups.map(group=><div key={group.title} className="mb-4"><p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">{group.title}</p>{group.items.map(([key,label,href])=><Link onClick={()=>setOpen(false)} key={key} href={href} className={`block rounded-xl px-3 py-2.5 text-sm font-bold ${active===key?'bg-white text-slate-950':'text-slate-300 hover:bg-white/10'}`}>{label}</Link>)}</div>)}
        <div className="mt-auto space-y-2 border-t border-white/10 pt-3"><Link href="/" className="block rounded-xl bg-violet-500/10 px-3 py-2.5 font-bold text-violet-300">View Store →</Link><button onClick={()=>signOut({callbackUrl:'/admin/login'})} className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-left font-bold">Sign out</button></div>
      </aside>
    </div>}
  </>;
}
