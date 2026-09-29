'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';
import AdminCommandPalette from './admin-command-palette';

type Active = string;
type NavItem = { key: string; label: string; href: string; permission?: string; ownerOnly?: boolean };
type NavGroup = { title: string; tone: string; items: NavItem[] };

const groups: NavGroup[] = [
  { title: 'Overview', tone: 'violet', items: [
    { key: 'dashboard', label: 'Dashboard', href: '/admin/dashboard' },
    { key: 'operations', label: 'Operations Center', href: '/admin/operations', permission: 'orders' },
  ]},
  { title: 'Commerce', tone: 'blue', items: [
    { key: 'orders', label: 'Orders', href: '/admin/orders', permission: 'orders' },
    { key: 'products', label: 'Products', href: '/admin/products', permission: 'products' },
    { key: 'inventory', label: 'Inventory', href: '/admin/inventory', permission: 'inventory' },
    { key: 'customers', label: 'Customers', href: '/admin/customers', permission: 'customers' },
  ]},
  { title: 'Catalog', tone: 'cyan', items: [
    { key: 'product-health', label: 'Product Health', href: '/admin/product-health', permission: 'products' },
    { key: 'duplicates', label: 'Duplicate Detector', href: '/admin/duplicate-detector', permission: 'products' },
  ]},
  { title: 'Marketplaces', tone: 'emerald', items: [
    { key: 'direct-import', label: 'Direct Product Import', href: '/admin/products#import', permission: 'marketplaces' },
    { key: 'marketplaces', label: 'Shopify & Marketplace Center', href: '/admin/marketplaces', permission: 'marketplaces' },
    { key: 'marketplace-history', label: 'Import History', href: '/admin/marketplaces/history', permission: 'marketplaces' },
    { key: 'marketplace-mapping', label: 'Category Mapping', href: '/admin/marketplaces/category-mapping', permission: 'marketplaces' },
  ]},
  { title: 'Growth', tone: 'fuchsia', items: [
    { key: 'pricing', label: 'Pricing', href: '/admin/pricing', permission: 'pricing' },
    { key: 'coupons', label: 'Coupons', href: '/admin/coupons' },
    { key: 'banners', label: 'Storefront', href: '/admin/banners' },
  ]},
  { title: 'Customer Care', tone: 'amber', items: [
    { key: 'support', label: 'Support', href: '/admin/support', permission: 'orders' },
    { key: 'reviews', label: 'Reviews', href: '/admin/reviews' },
    { key: 'notifications', label: 'Notifications', href: '/admin/notifications' },
  ]},
  { title: 'Insights', tone: 'indigo', items: [
    { key: 'analytics', label: 'Analytics', href: '/admin/analytics', permission: 'orders' },
    { key: 'goals', label: 'Business Goals', href: '/admin/goals' },
    { key: 'abandoned', label: 'Abandoned Checkouts', href: '/admin/abandoned-checkouts', permission: 'orders' },
  ]},
  { title: 'System', tone: 'slate', items: [
    { key: 'suppliers', label: 'Suppliers', href: '/admin/suppliers' },
    { key: 'automation', label: 'Automation Rules', href: '/admin/automation' },
    { key: 'features', label: 'Feature Flags', href: '/admin/feature-flags' },
    { key: 'integrations', label: 'Integration Events', href: '/admin/integration-events' },
    { key: 'system-health', label: 'System Health', href: '/admin/system-health', permission: 'settings' },
    { key: 'staff', label: 'Staff & Access', href: '/admin/staff', ownerOnly: true },
    { key: 'approvals', label: 'Approvals', href: '/admin/approvals', ownerOnly: true },
    { key: 'audit', label: 'Activity Log', href: '/admin/audit', ownerOnly: true },
    { key: 'settings', label: 'Settings', href: '/admin/settings', ownerOnly: true },
  ]},
];

const toneClass: Record<string, string> = {
  violet: 'bg-violet-400', blue: 'bg-blue-400', cyan: 'bg-cyan-400', emerald: 'bg-emerald-400',
  fuchsia: 'bg-fuchsia-400', amber: 'bg-amber-400', indigo: 'bg-indigo-400', slate: 'bg-slate-400',
};

export default function AdminNav({ active }: { active: Active }) {
  const [open, setOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/navigation', { cache: 'no-store' })
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
        setIsSuperAdmin(Boolean(data.isSuperAdmin));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const visibleGroups = useMemo(() => groups
    .map(group => ({
      ...group,
      items: group.items.filter(item =>
        (!item.permission || permissions.includes(item.permission) || isSuperAdmin) &&
        (!item.ownerOnly || isSuperAdmin),
      ),
    }))
    .filter(group => group.items.length > 0), [permissions, isSuperAdmin]);

  const renderItems = (mobile = false) => (
    <nav className="space-y-1">
      {visibleGroups.flatMap(group => group.items.map(item => ({ ...item, tone: group.tone }))).map(item => (
        <Link key={item.key} href={item.href} onClick={() => mobile && setOpen(false)}
          className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active === item.key ? 'bg-white text-slate-950 shadow-lg shadow-black/10' : 'text-slate-300 hover:bg-white/[.08] hover:text-white'}`}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${toneClass[item.tone] || toneClass.slate}`} />
          <span className="truncate">{item.label}</span>
        </Link>
      ))}
    </nav>
  );

  return <>
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-white/10 bg-[#080c18]/98 text-white shadow-2xl shadow-black/20 backdrop-blur-2xl lg:flex">
      <div className="border-b border-white/10 px-4 py-5">
        <Link href="/admin/dashboard" className="flex items-center gap-3 rounded-xl px-2 py-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-slate-950 shadow-lg">Z</span>
          <span><span className="block text-xl font-black tracking-tight">zenvora<span className="text-fuchsia-400">.</span></span><span className="mt-0.5 block text-[9px] font-black uppercase tracking-[.2em] text-slate-500">Commerce admin</span></span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {visibleGroups.map(group => <div key={group.title} className="mb-5">
          <p className="flex items-center gap-2 px-3 pb-2 text-[10px] font-black uppercase tracking-[.18em] text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${toneClass[group.tone] || toneClass.slate}`} />{group.title}
          </p>
          <div className="space-y-1">{group.items.map(item =>
            <Link key={item.key} href={item.href} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${active === item.key ? 'bg-white text-slate-950 shadow-lg shadow-black/10' : 'text-slate-300 hover:bg-white/[.08] hover:text-white'}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${toneClass[group.tone] || toneClass.slate}`} /><span className="truncate">{item.label}</span>
            </Link>
          )}</div>
        </div>)}
      </div>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 rounded-xl border border-white/10 bg-white/[.035] px-3 py-2">
          <p className="text-[9px] font-black uppercase tracking-[.18em] text-slate-500">{isSuperAdmin ? 'Store owner' : 'Staff account'}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-300">Access is enforced server-side</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/" className="rounded-xl bg-violet-500/10 px-3 py-2.5 text-center text-xs font-black text-violet-300 hover:bg-violet-500/20">View store</Link>
          <button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs font-black text-slate-300 hover:bg-white/10">Sign out</button>
        </div>
      </div>
    </aside>

    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080c18]/92 text-white shadow-lg shadow-black/5 backdrop-blur-2xl lg:ml-64">
      <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
        <button type="button" aria-label="Open admin menu" onClick={() => setOpen(true)} className="rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 lg:hidden">☰</button>
        <div className="min-w-0 flex-1"><AdminCommandPalette /></div>
        <Link href="/admin/notifications" aria-label="Notifications" className="rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 text-sm font-bold hover:bg-white/[.08]">Notifications</Link>
        <Link href="/" className="hidden rounded-xl bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-300 hover:bg-violet-500/20 sm:block">Open store ↗</Link>
      </div>
    </header>

    {open && <div className="fixed inset-0 z-[60] lg:hidden">
      <button aria-label="Close menu" className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
      <aside className="relative flex h-full w-[min(88vw,340px)] flex-col overflow-y-auto border-r border-white/10 bg-[#080c18] p-3 text-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-2 py-3">
          <Link href="/admin/dashboard" onClick={() => setOpen(false)} className="text-xl font-black">zenvora<span className="text-fuchsia-400">.</span></Link>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-3 py-2">×</button>
        </div>
        <div className="py-4">{renderItems(true)}</div>
        <div className="mt-auto space-y-2 border-t border-white/10 pt-3">
          <Link href="/" onClick={() => setOpen(false)} className="block rounded-xl bg-violet-500/10 px-3 py-2.5 text-center text-sm font-bold text-violet-300">View store</Link>
          <button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} className="w-full rounded-xl border border-white/10 px-3 py-2.5 text-left text-sm font-bold">Sign out</button>
        </div>
      </aside>
    </div>}
  </>;
}
