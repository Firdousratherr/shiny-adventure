import Link from 'next/link';
import { auth } from '../../auth';
import { db } from '../../lib/db';
import AddToCart from '../../components/add-to-cart';
import { productImageUrl } from '../../lib/product-image-url';

export default async function Products({ searchParams }: { searchParams: { q?: string; sort?: string; page?: string; category?: string } }) {
  const session = await auth();
  const loggedIn = !!session?.user?.email;
  const page = Math.max(1, Number(searchParams.page || 1) || 1);
  const size = 12;
  const q = searchParams.q?.trim();
  const category = searchParams.category?.trim();
  const where = {
    status: 'ACTIVE' as const,
    ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { description: { contains: q, mode: 'insensitive' as const } }, { category: { name: { contains: q, mode: 'insensitive' as const } } }] } : {}),
    ...(category ? { category: { slug: category } } : {}),
  };
  const orderBy = searchParams.sort === 'price-asc' ? { sellingPrice: 'asc' as const } : searchParams.sort === 'price-desc' ? { sellingPrice: 'desc' as const } : { createdAt: 'desc' as const };
  const [items, count, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * size,
      take: size,
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
    db.product.count({ where }),
    db.category.findMany({ orderBy: { name: 'asc' }, select: { name: true, slug: true }, take: 30 }),
  ]);
  const pages = Math.ceil(count / size);
  const query = (extra: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (searchParams.sort) params.set('sort', searchParams.sort);
    if (category) params.set('category', category);
    for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
    return params.toString();
  };

  return (
    <main className="min-h-screen bg-[#070b16] pb-24 text-white sm:pb-0">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#070b16]/95 backdrop-blur-xl">
        <div className="container flex h-14 items-center gap-2 sm:h-16 sm:gap-4">
          <Link href="/" className="shrink-0 text-lg font-black tracking-tight sm:text-2xl">🛍️ Zenvora<span className="text-fuchsia-400">.</span></Link>
          <form action="/products" className="hidden min-w-0 flex-1 md:block">
            <label className="relative block">
              <span className="sr-only">Search products</span>
              <input name="q" defaultValue={q} placeholder="Search products, brands and more..." className="h-11 w-full rounded-2xl border border-white/10 bg-white/[.045] px-4 text-sm outline-none placeholder:text-slate-500 focus:border-violet-400/70 focus:bg-white/[.06]"/>
            </label>
          </form>
          <nav className="hidden gap-5 text-sm font-bold text-slate-300 lg:flex">
            <Link href="/products" className="hover:text-white">Shop</Link>
            <Link href="/track" className="hover:text-white">Track Order</Link>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {loggedIn ? <Link href="/account" className="rounded-xl border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-xs font-bold hover:bg-white/[.06] sm:px-3 sm:py-2 sm:text-sm">Account</Link> : <Link href="/login" className="rounded-xl border border-white/10 bg-white/[.03] px-2.5 py-1.5 text-xs font-bold hover:bg-white/[.06] sm:px-3 sm:py-2 sm:text-sm">Login</Link>}
            <Link href="/cart" className="rounded-xl px-2 py-1 text-lg hover:bg-white/5" aria-label="View cart">🛒</Link>
          </div>
        </div>
      </header>

      <div className="container py-6 sm:py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-fuchsia-400">Premium products</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-5xl">Discover your next find</h1>
            <p className="mt-2 text-xs text-slate-400 sm:text-sm">{count} products available</p>
          </div>
          <form action="/products" className="zenvora-glass grid grid-cols-[1fr_auto_auto] gap-2 rounded-2xl p-2">
            <label>
              <span className="sr-only">Search</span>
              <input name="q" defaultValue={q} placeholder="Search..." className="min-w-0 rounded-xl border border-white/10 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-500 sm:w-56"/>
            </label>
            <select name="category" defaultValue={category || ''} className="max-w-[130px] rounded-xl border border-white/10 bg-[#101729] px-2 py-2.5 text-xs outline-none">
              <option value="">All categories</option>
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select name="sort" defaultValue={searchParams.sort || ''} className="max-w-[120px] rounded-xl border border-white/10 bg-[#101729] px-2 py-2.5 text-xs outline-none">
              <option value="">Newest</option>
              <option value="price-asc">Price low → high</option>
              <option value="price-desc">Price high → low</option>
            </select>
            <button className="col-span-3 min-h-11 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 hover:-translate-y-0.5 sm:col-span-1">Apply filters</button>
          </form>
        </div>

        {items.length === 0 ? (
          <div className="zenvora-empty-state mt-8">
            <div className="text-5xl">⌕</div>
            <p className="mt-4 text-lg font-black">No products found</p>
            <p className="mt-2 text-sm text-slate-500">Try another search term or choose a different category.</p>
            <Link href="/products" className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">Clear filters</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map(p => (
              <article key={p.id} className="zenvora-card group overflow-hidden">
                <Link href={"/product/" + p.slug} className="block">
                  <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-white/[.06] via-white/[.025] to-violet-900/20">
                    {p.images[0] ? (
                      <div className="flex h-full w-full items-center justify-center p-3 sm:p-5">
                        <img src={productImageUrl(p.images[0].url) || ''} alt={p.images[0].altText || p.name} className="h-full w-full object-contain transition duration-500 group-hover:scale-[1.04]"/>
                      </div>
                    ) : (
                      <div className="grid h-full place-items-center text-6xl">🛍️</div>
                    )}
                    <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
                      <span className="rounded-full border border-white/10 bg-[#070b16]/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-fuchsia-200 backdrop-blur-md">{p.category?.name || 'Zenvora'}</span>
                      {p.stock > 0 && p.stock <= 5 && <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[9px] font-black text-slate-950">Only {p.stock} left</span>}
                    </div>
                  </div>
                  <div className="p-4 sm:p-5">
                    <h2 className="line-clamp-2 min-h-11 text-sm font-bold leading-5 sm:text-base">{p.name}</h2>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xl font-black">₹{Number(p.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        <p className={`mt-1 text-[10px] font-semibold ${p.stock > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{p.stock > 0 ? 'In stock' : 'Out of stock'}</p>
                      </div>
                      <span className="rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 text-[10px] font-bold text-slate-300 transition group-hover:border-violet-400/30 group-hover:text-white">View →</span>
                    </div>
                  </div>
                </Link>
                <div className="border-t border-white/10 p-3 sm:p-4">
                  <AddToCart product={{ id: p.id, name: p.name, price: Number(p.sellingPrice), image: productImageUrl(p.images[0]?.url), stock: p.stock }}/>
                </div>
              </article>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => i + 1).map(n => <Link key={n} href={"/products?" + query({ page: String(n) })} className={"rounded-xl px-3.5 py-2.5 text-xs font-bold " + (n === page ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/25' : 'border border-white/10 bg-white/[.035] text-slate-300 hover:bg-white/[.07]')}>{n}</Link>)}
          </div>
        )}
      </div>
    </main>
  );
}
