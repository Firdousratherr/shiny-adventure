'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from './cart-provider';

export default function MobileNav() {
  const pathname = usePathname();
  const { count } = useCart();
  if (pathname?.startsWith('/admin')) return null;
  const items = [
    ['/', '⌂', 'Home'],
    ['/products', '⌕', 'Shop'],
    ['/track', '↗', 'Track'],
    ['/cart', '🛒', 'Cart'],
    ['/account', '◉', 'Account'],
  ] as const;
  return <nav className="fixed inset-x-2 bottom-2 z-50 grid grid-cols-5 rounded-2xl border border-white/10 bg-[#0b1020]/95 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl md:hidden" aria-label="Mobile navigation">
    {items.map(([href, icon, label]) => {
      const active = href === '/' ? pathname === '/' : Boolean(pathname?.startsWith(href));
      return <Link key={href} href={href} className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl text-[10px] font-bold ${active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
        <span className="text-base leading-none">{icon}</span><span className="mt-0.5">{label}</span>
        {label === 'Cart' && count > 0 && <span className="absolute right-2 top-1 min-w-4 rounded-full bg-fuchsia-500 px-1 text-center text-[9px] font-black text-white">{count > 99 ? '99+' : count}</span>}
      </Link>;
    })}
  </nav>;
}