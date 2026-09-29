'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Props = {
  loggedIn?: boolean;
  searchValue?: string;
};

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8"/></svg>;
}

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"><path d="M12 12a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm-7 8.4c1.25-3.55 3.57-5.32 7-5.32s5.75 1.77 7 5.32" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7"/></svg>;
}

function CartIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5"><path d="M4 5h2l1.5 10h9.75L20 8H7.2m2.5 12.3a1.4 1.4 0 1 0 0 .01m7.1-.01a1.4 1.4 0 1 0 0 .01" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7"/></svg>;
}

export default function StoreHeader({ loggedIn = false, searchValue = '' }: Props) {
  const pathname = usePathname();

  const nav = [
    ['/products', 'All Categories'],
    ['/products?category=fashion', 'Fashion'],
    ['/products?category=electronics', 'Electronics'],
    ['/products?category=home', 'Home & Living'],
    ['/products?category=beauty', 'Beauty'],
    ['/products?category=kitchen', 'Kitchen'],
    ['/products?sort=price-desc', 'Deals'],
  ] as const;

  return (
    <header className="zenvora-store-header sticky top-0 z-50 border-b border-slate-100 bg-white/90 backdrop-blur-xl">
      <div className="container">
        <div className="zenvora-header-shell flex min-h-[70px] items-center gap-3 rounded-b-2xl border-x-0 border-t-0 px-2 sm:min-h-[76px] sm:gap-5 sm:px-4">
          <Link href="/" className="brand-mark group shrink-0 text-[1.35rem] font-black tracking-[-.055em] sm:text-2xl">
            Zenvora<span className="text-fuchsia-500">.</span>
          </Link>

          <form action="/products" className="hidden min-w-0 flex-1 md:block">
            <label className="relative block">
              <span className="sr-only">Search products</span>
              <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-slate-400"><SearchIcon /></span>
              <input name="q" defaultValue={searchValue} placeholder="Search amazing products..." className="zenvora-header-search h-11 w-full rounded-full px-4 pl-11 text-sm outline-none" />
              <button type="submit" className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-md shadow-violet-500/20" aria-label="Search"><SearchIcon /></button>
            </label>
          </form>

          <nav className="hidden items-center gap-1 lg:flex">
            <Link href="/track" className="rounded-xl px-3 py-2 text-xs font-extrabold text-slate-500 hover:bg-violet-50 hover:text-violet-700">Track order</Link>
            <Link href={loggedIn ? '/account' : '/login'} className="zenvora-header-icon rounded-xl p-2.5" aria-label={loggedIn ? 'Account' : 'Login'}><UserIcon /></Link>
            <Link href="/cart" className="zenvora-header-icon rounded-xl p-2.5" aria-label="Cart"><CartIcon /></Link>
            <Link href={loggedIn ? '/account' : '/signup'} className="ml-1 inline-flex rounded-full bg-gradient-to-r from-violet-700 via-violet-600 to-fuchsia-500 px-4 py-2.5 text-xs font-black text-white shadow-lg shadow-violet-500/20 hover:-translate-y-0.5">
              {loggedIn ? 'My Zenvora' : 'Get started'}
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <Link href={loggedIn ? '/account' : '/login'} className="zenvora-header-icon rounded-xl p-2.5" aria-label={loggedIn ? 'Account' : 'Login'}><UserIcon /></Link>
            <Link href="/cart" className="zenvora-header-icon rounded-xl p-2.5" aria-label="Cart"><CartIcon /></Link>
          </div>
        </div>

        <form action="/products" className="pb-2 pt-2 md:hidden">
          <label className="relative block">
            <span className="sr-only">Search products</span>
            <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-slate-400"><SearchIcon /></span>
            <input name="q" defaultValue={searchValue} placeholder="Search Zenvora..." className="zenvora-header-search h-11 w-full rounded-full px-4 pl-11 text-sm outline-none" />
          </label>
        </form>
      </div>

      <div className="zenvora-header-nav hidden md:block">
        <div className="container overflow-x-auto [scrollbar-width:none]">
          <nav className="flex min-w-max items-center justify-center gap-1 py-2">
            {nav.map(([href, label]) => {
              const root = href.split('?')[0];
              const active = pathname === root && (label === 'All Categories' || pathname === '/products');
              return <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={label === 'Deals' ? 'hot rounded-full px-3.5 py-2' : 'rounded-full px-3.5 py-2'}>{label}</Link>;
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}
