'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';

export default function AdminNav({ active }: { active: 'dashboard'|'products'|'orders'|'settings' }) {
  const items = [
    ['dashboard','Dashboard','/admin/dashboard'],
    ['products','Products','/admin/products'],
    ['orders','Orders','/admin/orders'],
    ['settings','Settings','/admin/settings'],
  ] as const;
  return <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
    <div className="container flex min-h-16 flex-wrap items-center justify-between gap-3 py-2">
      <Link href="/admin/dashboard" className="text-xl font-black">zenvora<span className="text-indigo-600">.</span><span className="ml-2 hidden text-xs font-bold uppercase tracking-widest text-slate-400 sm:inline">Admin</span></Link>
      <nav className="flex max-w-full items-center gap-1 overflow-x-auto text-sm font-bold">
        {items.map(([key,label,href]) => <Link key={key} href={href} className={`shrink-0 rounded-lg px-3 py-2 ${active===key?'bg-slate-900 text-white':'hover:bg-slate-100'}`}>{label}</Link>)}
        <Link href="/" className="shrink-0 rounded-lg bg-indigo-50 px-3 py-2 text-indigo-700">Store</Link>
        <button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">Sign out</button>
      </nav>
    </div>
  </header>;
}
