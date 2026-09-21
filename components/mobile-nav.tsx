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
  return <nav className="zenvora-mobile-nav fixed inset-x-2 bottom-2 z-[70] grid grid-cols-5 rounded-[22px] border border-white/10 bg-[#0b1020]/96 p-1.5 shadow-2xl backdrop-blur-2xl md:hidden" aria-label="Mobile navigation">
    {items.map(([href, icon, label]) => {
      const active = href === '/' ? pathname === '/' : Boolean(pathname?.startsWith(href));
      return <Link key={href} href={href} className={`relative flex min-h-13 flex-col items-center justify-center rounded-[16px] px-1 text-[10px] font-extrabold transition ${active ? 'bg-white text-slate-950 shadow-lg shadow-white/10' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
        <span className="text-base leading-none">{icon}</span><span className="mt-1">{label}</span>
        {label === 'Cart' && count > 0 && <span className="absolute right-1.5 top-1 min-w-4 rounded-full bg-fuchsia-500 px-1 text-center text-[9px] font-black text-white shadow-lg shadow-fuchsia-900/40">{count > 99 ? '99+' : count}</span>}
      </Link>;
    })}
  </nav>;
}