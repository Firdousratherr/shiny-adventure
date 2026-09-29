'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Props = {
  loggedIn?: boolean;
  searchValue?: string;
};

export default function StoreHeader({ loggedIn = false, searchValue = '' }: Props) {
  const pathname = usePathname();

  const nav = [
    ['/products', 'Shop'],
    ['/products?sort=price-desc', 'Deals'],
    ['/track', 'Track Order'],
  ] as const;

  return (
    <header className="zenvora-store-header sticky top-0 z-50 border-b border-white/10 bg-[#070b16]/75 backdrop-blur-2xl">
      <div className="container">
        <div className="flex h-[68px] items-center gap-3 sm:h-[76px] sm:gap-5">
          <Link href="/" className="group shrink-0 text-[1.35rem] font-black tracking-[-.04em] sm:text-2xl">
            <span className="text-white">zenvora</span><span className="text-fuchsia-400 transition group-hover:text-violet-300">.</span>
          </Link>

          <form action="/products" className="hidden min-w-0 flex-1 md:block">
            <label className="relative block">
              <span className="sr-only">Search products</span>
              <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-lg text-slate-500">⌕</span>
              <input
                name="q"
                defaultValue={searchValue}
                placeholder="Search products, brands and more..."
                className="h-11 w-full rounded-2xl border border-white/10 bg-white/[.045] pl-11 pr-4 text-sm text-white outline-none transition focus:border-violet-400/60 focus:bg-white/[.065]"
              />
            </label>
          </form>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map(([href, label]) => {
              const active = pathname === href || (href === '/products' && pathname?.startsWith('/products'));
              return (
                <Link
                  key={href}
                  href={href}
                  className={'rounded-xl px-3.5 py-2.5 text-sm font-bold transition ' + (active ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white')}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {loggedIn ? (
              <Link href="/account" className="hidden rounded-xl border border-white/10 bg-white/[.035] px-3.5 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/[.07] sm:inline-flex">
                Account
              </Link>
            ) : (
              <Link href="/login" className="hidden rounded-xl border border-white/10 bg-white/[.035] px-3.5 py-2.5 text-sm font-bold text-slate-200 hover:bg-white/[.07] sm:inline-flex">
                Login
              </Link>
            )}
            <Link href="/cart" className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[.035] text-lg hover:bg-white/[.07]" aria-label="Open cart">
              🛒
            </Link>
            <Link href={loggedIn ? '/account' : '/signup'} className="hidden rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 shadow-xl shadow-black/10 hover:-translate-y-0.5 sm:inline-flex">
              {loggedIn ? 'My Zenvora' : 'Get started'}
            </Link>
          </div>
        </div>

        <form action="/products" className="pb-3 md:hidden">
          <label className="relative block">
            <span className="sr-only">Search products</span>
            <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-lg text-slate-500">⌕</span>
            <input
              name="q"
              defaultValue={searchValue}
              placeholder="Search Zenvora..."
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[.045] pl-11 pr-4 text-sm outline-none focus:border-violet-400/60"
            />
          </label>
        </form>
      </div>
    </header>
  );
}
