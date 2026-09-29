'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signOut } from 'next-auth/react';
import AdminCommandPalette from './admin-command-palette';

type Active = 'dashboard'|'operations'|'products'|'product-health'|'duplicates'|'inventory'|'analytics'|'pricing'|'coupons'|'banners'|'orders'|'customers'|'settings'|'staff'|'approvals'|'marketplaces'|'audit'|'support'|'notifications'|'suppliers'|'reviews'|'automation'|'features'|'goals'|'integrations';

const groups = [
  { title: 'Overview', items: [['dashboard','Dashboard','/admin/dashboard'],['operations','Operations Center','/admin/operations']] },
  { title: 'Commerce', items: [['orders','Orders','/admin/orders'],['products','Products','/admin/products'],['product-health','Product Health','/admin/product-health'],['duplicates','Duplicate Detector','/admin/duplicate-detector'],['inventory','Inventory','/admin/inventory'],['customers','Customers','/admin/customers']] },
  { title: 'Growth', items: [['pricing','Pricing','/admin/pricing'],['coupons','Coupons','/admin/coupons'],['banners','Storefront','/admin/banners']] },
  { title: 'Channels', items: [['marketplaces','Marketplace Center','/admin/marketplaces'],['suppliers','Suppliers','/admin/suppliers']] },
  { title: 'Customer Care', items: [['support','Support','/admin/support'],['notifications','Notifications','/admin/notifications'],['reviews','Reviews','/admin/reviews']] },
  { title: 'Insights', items: [['analytics','Analytics','/admin/analytics'],['goals','Business Goals','/admin/goals']] },
  { title: 'System', items: [['automation','Automation Rules','/admin/automation'],['features','Feature Flags','/admin/feature-flags'],['integrations','Integration Events','/admin/integration-events'],['staff','Staff & Access','/admin/staff'],['approvals','Approvals','/admin/approvals'],['audit','Activity Log','/admin/audit'],['settings','Settings','/admin/settings']] },
] as const;

export default function AdminNav({ active }: { active: Active }) {
  const [open, setOpen] = useState(false);

  const navGroups = (close?: boolean) => groups.map((group) => (
    <div key={group.title} className="mb-5">
      <p className="nav-group-label px-3 pb-2 text-[10px] font-black uppercase tracking-[.18em]">{group.title}</p>
      <nav className="space-y-1">
        {group.items.map(([key, label, href]) => {
          const activeClass = active === key ? 'nav-item-active' : '';
          return (
            <Link key={key} href={href} onClick={close ? () => setOpen(false) : undefined} className={'nav-item ' + activeClass + ' flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-extrabold'}>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-100 text-[11px] font-black text-violet-700">{label.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">{label}</span>
              {active === key ? <span className="text-xs opacity-80">›</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  ));

  return (
    <>
      <aside className="admin-sidebar fixed inset-y-0 left-0 z-50 hidden w-[272px] flex-col border-r lg:flex">
        <div className="border-b border-slate-100 px-5 py-5">
          <Link href="/admin/dashboard" className="brand-mark flex items-center gap-2 text-2xl font-black tracking-[-.05em]">Zenvora<span className="text-fuchsia-500">.</span><span className="rounded-full bg-violet-50 px-2 py-1 text-[9px] uppercase tracking-[.15em] text-violet-700">Admin</span></Link>
          <p className="mt-2 text-xs text-slate-400">Manage every part of your store.</p>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">{navGroups()}</div>
        <div className="space-y-2 border-t border-slate-100 p-3">
          <Link href="/" className="block rounded-xl bg-violet-50 px-3 py-2.5 text-sm font-black text-violet-700 hover:bg-violet-100">View storefront →</Link>
          <button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-extrabold text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700">Sign out</button>
        </div>
      </aside>

      <header className="admin-topbar sticky top-0 z-40 border-b lg:ml-[272px]">
        <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
          <button type="button" aria-label="Open admin menu" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 lg:hidden">☰</button>
          <div className="min-w-0 flex-1"><AdminCommandPalette /></div>
          <Link href="/admin/notifications" className="admin-accent grid h-10 w-10 place-items-center rounded-xl text-sm" aria-label="Notifications">⌁</Link>
          <Link href="/" className="hidden rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:border-violet-200 hover:text-violet-700 sm:block">Store</Link>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="admin-sidebar relative flex h-full w-[min(88vw,330px)] flex-col overflow-y-auto border-r p-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-2 py-3">
              <Link href="/admin/dashboard" className="brand-mark text-xl font-black">Zenvora<span className="text-fuchsia-500">.</span></Link>
              <button onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600">×</button>
            </div>
            <div className="py-3">{navGroups(true)}</div>
            <div className="mt-auto border-t border-slate-100 pt-3">
              <Link href="/" className="block rounded-xl bg-violet-50 px-3 py-2.5 font-black text-violet-700">View storefront →</Link>
              <button onClick={() => signOut({ callbackUrl: '/admin/login' })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left font-black text-slate-600">Sign out</button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
