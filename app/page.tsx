import Image from 'next/image';
import Link from 'next/link';
import { auth } from '../auth';
import { db } from '../lib/db';
import StoreHeader from '../components/store-header';
import ProductCard from '../components/product-card';

function safeBannerHref(value: string | null) {
  if (!value) return '/products';
  const trimmed = value.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? url.toString() : '/products';
  } catch {
    return '/products';
  }
}

const categories = [
  ['📱', 'Electronics', 'electronics'],
  ['🎧', 'Audio', 'audio'],
  ['👕', 'Fashion', 'fashion'],
  ['🏠', 'Home', 'home'],
  ['💄', 'Beauty', 'beauty'],
  ['🎮', 'Toys & Games', 'toys-games'],
  ['🏃', 'Sports', 'sports'],
  ['👜', 'Bags', 'bags'],
] as const;

export default async function Home() {
  const session = await auth();
  const loggedIn = !!session?.user?.email;
  const now = new Date();

  const [banners, products] = await Promise.all([
    db.storeBanner.findMany({
      where: {
        enabled: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 3,
    }),
    db.product.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        name: true,
        slug: true,
        sellingPrice: true,
        stock: true,
        category: { select: { name: true } },
        images: { orderBy: { sortOrder: 'asc' }, take: 1, select: { url: true, altText: true } },
      },
    }),
  ]);

  return (
    <main className="store-dark min-h-screen overflow-x-hidden bg-[#070b16] text-white">
      <StoreHeader loggedIn={loggedIn} />

      <section className="zenvora-home-hero relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_76%_34%,rgba(168,85,247,.28),transparent_28%),radial-gradient(circle_at_12%_8%,rgba(59,130,246,.18),transparent_25%),linear-gradient(180deg,#070b16_0%,#090d1a_100%)]" />
        <div className="absolute -right-28 top-12 -z-10 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl animate-pulse" />
        <div className="absolute -left-24 bottom-0 -z-10 h-72 w-72 rounded-full bg-violet-600/10 blur-3xl" />

        <div className="container grid min-h-[650px] items-center gap-10 py-14 lg:grid-cols-[1.03fr_.97fr] lg:py-20">
          <div className="zenvora-reveal max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/25 bg-fuchsia-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-[.24em] text-fuchsia-200">
              <span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_14px_rgba(232,121,249,.9)]" />
              Premium finds · Made for India
            </span>

            <h1 className="mt-6 text-[3.35rem] font-black leading-[.97] tracking-[-.055em] sm:text-6xl lg:text-[5.55rem]">
              Shop smarter.
              <span className="block bg-gradient-to-r from-white via-fuchsia-200 to-violet-400 bg-clip-text text-transparent">
                Live better.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-sm leading-7 text-slate-300 sm:text-lg">
              Discover useful, stylish products at prices that make everyday shopping feel effortless.
              Fast delivery, secure checkout and a marketplace built around trust.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="zenvora-primary-btn inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-black">
                Explore products <span>→</span>
              </Link>
              <Link href="/products?sort=price-desc" className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[.045] px-6 py-3.5 text-sm font-black text-white hover:bg-white/[.08]">
                View deals <span className="text-fuchsia-300">✦</span>
              </Link>
            </div>

            <div className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['🚚', 'Fast delivery', 'Across India'],
                ['🔒', 'Secure payments', 'Protected checkout'],
                ['↻', 'Easy returns', '7-day support'],
                ['💬', 'Human support', 'We are here'],
              ].map(([icon, title, detail]) => (
                <div key={title} className="zenvora-mini-stat">
                  <span className="text-lg">{icon}</span>
                  <p className="mt-2 text-xs font-black text-white">{title}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden min-h-[530px] items-center justify-center lg:flex">
            <div className="absolute h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
            <div className="zenvora-showcase-card relative h-[455px] w-full max-w-[540px] overflow-hidden rounded-[38px] border border-white/10 bg-gradient-to-br from-violet-700/30 via-fuchsia-500/10 to-white/[.03] p-8 shadow-2xl shadow-violet-950/40">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.08),transparent_30%)]" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <span className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-white/70">Zenvora edit</span>
                  <span className="rounded-full bg-fuchsia-300 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow-lg shadow-fuchsia-500/20">UP TO 50% OFF</span>
                </div>
                <div className="relative mx-auto w-full max-w-[360px]">
                  <div className="absolute inset-0 rounded-full bg-fuchsia-400/15 blur-3xl" />
                  <div className="relative grid place-items-center">
                    <div className="text-[8.5rem] drop-shadow-[0_24px_35px_rgba(0,0,0,.35)]">🎧</div>
                    <div className="-mt-8 text-[6rem] drop-shadow-[0_24px_35px_rgba(0,0,0,.35)]">👟</div>
                  </div>
                </div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[.18em] text-fuchsia-200">Fresh picks</p>
                    <p className="mt-2 text-2xl font-black">Everyday upgrades</p>
                  </div>
                  <Link href="/products" className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/10 text-xl hover:bg-white/15">↗</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[.018]">
        <div className="container overflow-x-auto py-4 [scrollbar-width:none]">
          <div className="flex min-w-max gap-2.5">
            {categories.map(([icon, label, slug]) => (
              <Link key={slug} href={'/products?category=' + slug} className="zenvora-category-pill">
                <span>{icon}</span>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {banners.length > 0 ? (
        <section className="container pt-7">
          <div className="grid gap-4 md:grid-cols-3">
            {banners.map((banner, index) => (
              <Link key={banner.id} href={safeBannerHref(banner.linkUrl)} className={'zenvora-promo-card ' + (index === 0 ? 'md:col-span-2 min-h-[250px]' : 'min-h-[250px]')}>
                {banner.imageUrl ? <Image src={banner.imageUrl} alt={banner.title} fill sizes="(max-width: 768px) 100vw, 66vw" className="object-cover opacity-35" /> : null}
                <div className="absolute inset-0 bg-gradient-to-br from-violet-950/85 via-violet-900/40 to-fuchsia-950/60" />
                <div className="relative mt-auto max-w-xl">
                  <span className="text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-200">Limited offer</span>
                  <h2 className="mt-2 text-2xl font-black">{banner.title}</h2>
                  {banner.subtitle ? <p className="mt-2 max-w-md text-sm text-slate-200/80">{banner.subtitle}</p> : null}
                  {banner.buttonText ? <span className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-xs font-black text-slate-950">{banner.buttonText} →</span> : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="container py-16 sm:py-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.24em] text-fuchsia-400">Curated for you</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Trending right now</h2>
            <p className="mt-2 text-sm text-slate-500">Fresh arrivals picked from the Zenvora marketplace.</p>
          </div>
          <Link href="/products" className="hidden rounded-xl border border-white/10 bg-white/[.035] px-4 py-2.5 text-xs font-black text-slate-200 hover:bg-white/[.07] sm:inline-flex">
            View all →
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
          {!products.length ? (
            <div className="zenvora-empty-state col-span-full">
              <div className="text-5xl">🛍️</div>
              <p className="mt-4 text-lg font-black">Your catalog is getting ready</p>
              <p className="mt-2 text-sm text-slate-500">Published products will appear here.</p>
            </div>
          ) : null}
        </div>

        <div className="mt-7 text-center sm:hidden">
          <Link href="/products" className="inline-flex rounded-xl border border-white/10 bg-white/[.035] px-5 py-3 text-xs font-black">
            View all products →
          </Link>
        </div>
      </section>

      <section className="container pb-16">
        <div className="zenvora-trust-band">
          {[
            ['01', 'Thoughtful selection', 'Products chosen for everyday value.'],
            ['02', 'Transparent checkout', 'Clear pricing before you pay.'],
            ['03', 'Support when needed', 'Real help when something goes wrong.'],
          ].map(([n, title, detail]) => (
            <div key={n} className="flex gap-4 border-white/10 py-4 first:pt-0 last:pb-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0 md:py-0">
              <span className="font-mono text-xs text-fuchsia-400">{n}</span>
              <div>
                <p className="text-sm font-black">{title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/10 bg-[#050812]">
        <div className="container grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="text-2xl font-black tracking-[-.04em]">zenvora<span className="text-fuchsia-400">.</span></Link>
            <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">Shop smart. Discover better everyday products and a cleaner way to buy online.</p>
          </div>
          <div>
            <h3 className="text-sm font-black">Shop</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-500">
              <Link className="block hover:text-white" href="/products">All products</Link>
              <Link className="block hover:text-white" href="/products?sort=price-desc">Deals</Link>
              <Link className="block hover:text-white" href="/track">Track order</Link>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-black">Account</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-500">
              {loggedIn ? <Link className="block hover:text-white" href="/account">My account</Link> : <><Link className="block hover:text-white" href="/login">Customer login</Link><Link className="block hover:text-white" href="/signup">Create account</Link></>}
              <Link className="block hover:text-white" href="/cart">Shopping cart</Link>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-black">Zenvora</h3>
            <div className="mt-4 space-y-2 text-sm text-slate-500">
              <Link className="block hover:text-white" href="/privacy">Privacy</Link>
              <Link className="block hover:text-white" href="/terms">Terms</Link>
              <Link className="block hover:text-white" href="/admin/login">Administrator login</Link>
            </div>
          </div>
        </div>
        <div className="container border-t border-white/10 py-5 text-xs text-slate-600">© 2026 Zenvora. All rights reserved.</div>
      </footer>
    </main>
  );
}
