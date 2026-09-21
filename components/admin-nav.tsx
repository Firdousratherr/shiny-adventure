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
  return <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1020]/95 text-white backdrop-blur">
    <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
      <Link href="/admin/dashboard" className="text-xl font-black">zenvora<span className="text-violet-400">.</span><span className="ml-2 hidden text-xs font-bold uppercase tracking-widest text-slate-500 sm:inline">Admin</span></Link>
      <nav className="flex max-w-full items-center gap-1 overflow-x-auto text-sm font-bold">
        {items.map(([key,label,href]) => <Link key={key} href={href} className={`shrink-0 rounded-lg px-3 py-2 ${active===key?'bg-white text-slate-950':'text-slate-300 hover:bg-white/10 hover:text-white'}`}>{label}</Link>)}
        <Link href="/" className="shrink-0 rounded-lg bg-violet-500/10 px-3 py-2 text-violet-300 hover:bg-violet-500/20">Store</Link>
        <button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white">Sign out</button>
      </nav>
    </div>
  </header>;
}
