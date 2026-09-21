'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';

export default function AdminNav({ active }: { active: 'dashboard'|'products'|'pricing'|'orders'|'settings'|'staff'|'approvals'|'audit'|'marketplaces' }) {
  const items = [
    ['dashboard','Dashboard','/admin/dashboard'],
    ['products','Products','/admin/products'],
    ['pricing','Pricing','/admin/pricing'],
    ['orders','Orders','/admin/orders'],
    ['settings','Settings','/admin/settings'],
    ['staff','Staff & Access','/admin/staff'],
    ['approvals','Approvals','/admin/approvals'],
    ['marketplaces','Marketplaces','/admin/marketplaces'],
    ['audit','Activity Log','/admin/audit'],
  ] as const;
  return <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1020]/90 text-white backdrop-blur-2xl">
    <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
      <Link href="/admin/dashboard" className="shrink-0 text-xl font-black tracking-tight">zenvora<span className="text-fuchsia-400">.</span><span className="ml-2 hidden rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-[.18em] text-slate-400 sm:inline">Admin</span></Link>
      <nav className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-0.5 text-sm font-bold [scrollbar-width:none]">
        {items.map(([key,label,href]) => <Link key={key} href={href} className={`shrink-0 rounded-xl px-3 py-2.5 ${active===key?'bg-white text-slate-950 shadow-lg shadow-white/10':'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{label}</Link>)}
        <Link href="/" className="shrink-0 rounded-xl bg-violet-500/10 px-3 py-2.5 text-violet-300 hover:bg-violet-500/20">Store</Link>
        <button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} className="shrink-0 rounded-xl border border-white/10 px-3 py-2.5 text-slate-300 hover:bg-white/10 hover:text-white">Sign out</button>
      </nav>
    </div>
  </header>;
}