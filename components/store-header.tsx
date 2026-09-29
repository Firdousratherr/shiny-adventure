'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from './cart-provider';

function Icon({ name }: { name: 'search'|'cart'|'user'|'truck'|'menu' }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, viewBox: '0 0 24 24', className: 'h-5 w-5' };
  if (name === 'search') return <svg {...common}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>;
  if (name === 'cart') return <svg {...common}><path d="M3.5 5h2l1.6 9.1a1.8 1.8 0 0 0 1.8 1.5h8.7a1.8 1.8 0 0 0 1.7-1.3L21 8H7.1" /><circle cx="10" cy="19" r="1.25" /><circle cx="18" cy="19" r="1.25" /></svg>;
  if (name === 'user') return <svg {...common}><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></svg>;
  if (name === 'truck') return <svg {...common}><path d="M3 6.5h11v9H3z" /><path d="M14 10h3.5l3.5 3.2v2.3H14z" /><circle cx="7" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" /></svg>;
  return <svg {...common}><path d="M5 7h14M5 12h14M5 17h14" /></svg>;
}

export default function StoreHeader({ loggedIn = false }: { loggedIn?: boolean }) {
  const pathname = usePathname();
  const { count } = useCart();
  const active = (href: string) => href === '/' ? pathname === '/' : Boolean(pathname?.startsWith(href));

  return (
    <header className="store-header sticky top-0 z-50">
      <div className="store-header-glow" aria-hidden="true" />
      <div className="store-container flex min-h-[66px] items-center gap-3 sm:min-h-[74px] sm:gap-5">
        <Link href="/" className="store-logo shrink-0" aria-label="Zenvora home">
          <span className="store-logo-mark">Z</span>
          <span>zenvora<span className="text-violet-600">.</span></span>
        </Link>

        <form action="/products" className="hidden min-w-0 flex-1 md:block">
          <label className="store-search">
            <span className="sr-only">Search products</span>
            <Icon name="search" />
            <input name="q" defaultValue={pathname === '/products' ? undefined : undefined} placeholder="Search products, brands and more..." />
            <span className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 lg:inline-flex">⌘ K</span>
          </label>
        </form>

        <nav className="hidden items-center gap-1 lg:flex">
          {[
            ['/', 'Home'],
            ['/products', 'Shop'],
            ['/products?sort=price-desc', 'Deals'],
            ['/track', 'Track order'],
          ].map(([href, label]) => (
            <Link key={href} href={href} className={`store-nav-link ${active(href.split('?')[0]) ? 'is-active' : ''}`}>{label}</Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Link href={loggedIn ? '/account' : '/login'} className="store-icon-btn" aria-label={loggedIn ? 'My account' : 'Login'}>
            <Icon name="user" />
            <span className="hidden xl:inline">{loggedIn ? 'Account' : 'Login'}</span>
          </Link>
          <Link href="/cart" className="store-icon-btn relative" aria-label="View cart">
            <Icon name="cart" />
            <span className="hidden xl:inline">Cart</span>
            {count > 0 && <span className="store-cart-badge">{count > 99 ? '99+' : count}</span>}
          </Link>
          <button type="button" className="store-icon-btn md:hidden" aria-label="Menu"><Icon name="menu" /></button>
        </div>
      </div>
      <div className="store-mobile-search store-container md:hidden">
        <form action="/products">
          <label className="store-search">
            <Icon name="search" />
            <input name="q" placeholder="What are you looking for?" />
            <button type="submit" className="store-search-go">Search</button>
          </label>
        </form>
      </div>
      <div className="store-header-line" aria-hidden="true" />
    </header>
  );
}
