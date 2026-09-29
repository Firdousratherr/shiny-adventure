import Link from 'next/link';
import { auth } from '../../auth';
import { db } from '../../lib/db';
import StoreHeader from '../../components/store-header';
import ProductCard from '../../components/product-card';

export default async function Products({ searchParams }: { searchParams: { q?: string; sort?: string; page?: string; category?: string } }) {
  const session = await auth();
  const loggedIn = !!session?.user?.email;
  const page = Math.max(1, Number(searchParams.page || 1) || 1);
  const size = 12;
  const q = searchParams.q?.trim();
  const category = searchParams.category?.trim();

  const where = {
    status: 'ACTIVE' as const,
    ...(q ? {
      OR: [
        { name: { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
        { category: { name: { contains: q, mode: 'insensitive' as const } } },
      ],
    } : {}),
    ...(category ? { category: { slug: category } } : {}),
  };

  const orderBy =
    searchParams.sort === 'price-asc' ? { sellingPrice: 'asc' as const } :
    searchParams.sort === 'price-desc' ? { sellingPrice: 'desc' as const } :
    { createdAt: 'desc' as const };

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
    for (const [key, value] of Object.entries(extra)) if (value) params.set(key, value);
    return params.toString();
  };

  return (
    <main className="store-dark min-h-screen bg-[#070b16] pb-28 text-white sm:pb-0">
      <StoreHeader loggedIn={loggedIn} searchValue={q || ''} />

      <div className="container py-7 sm:py-10">
        <div className="zenvora-page-hero">
          <div>
            <span className="inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-violet-200">The Zenvora catalog</span>
            <h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-5xl">Find something you’ll love.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{count} products available{q ? ' for "' + q + '"' : ''}. Browse by category, refine the price or sort by what’s new.</p>
          </div>
          <div className="zenvora-page-hero-orb hidden sm:block"><span>✦</span></div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[240px_1fr]">
          <aside className="zenvora-filter-panel h-fit lg:sticky lg:top-24">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Refine</h2>
              <Link href="/products" className="text-[10px] font-bold text-violet-300 hover:text-white">Reset</Link>
            </div>

            <form action="/products" className="mt-5 space-y-4">
              <label className="block text-xs font-bold text-slate-400">
                Search
                <input name="q" defaultValue={q} placeholder="Search products..." className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[.035] px-3 text-sm outline-none focus:border-violet-400/60" />
              </label>

              <label className="block text-xs font-bold text-slate-400">
                Category
                <select name="category" defaultValue={category || ''} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#101729] px-3 text-sm outline-none focus:border-violet-400/60">
                  <option value="">All categories</option>
                  {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-400">
                Sort by
                <select name="sort" defaultValue={searchParams.sort || ''} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#101729] px-3 text-sm outline-none focus:border-violet-400/60">
                  <option value="">Newest</option>
                  <option value="price-asc">Price: low → high</option>
                  <option value="price-desc">Price: high → low</option>
                </select>
              </label>

              <button className="w-full rounded-xl bg-white px-4 py-3 text-xs font-black text-slate-950 shadow-xl shadow-black/10 hover:-translate-y-0.5">Apply filters</button>
            </form>

            <div className="mt-5 border-t border-white/10 pt-5">
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-slate-500">Why Zenvora</p>
              <div className="mt-3 space-y-3 text-xs text-slate-300">
                <p><span className="mr-2 text-emerald-300">✓</span>Secure checkout</p>
                <p><span className="mr-2 text-emerald-300">✓</span>Clear product pricing</p>
                <p><span className="mr-2 text-emerald-300">✓</span>Support when needed</p>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-500"><span className="text-slate-200">{count}</span> results</p>
              <div className="h-px flex-1 bg-white/10" />
              {category ? <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-[10px] font-bold text-slate-300">#{category}</span> : null}
            </div>

            {items.length === 0 ? (
              <div className="zenvora-empty-state mt-4">
                <div className="text-5xl">⌕</div>
                <p className="mt-4 text-lg font-black">No products found</p>
                <p className="mt-2 text-sm text-slate-500">Try a different search term or clear your filters.</p>
                <Link href="/products" className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">Clear filters</Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            )}

            {pages > 1 ? (
              <div className="mt-9 flex flex-wrap justify-center gap-2">
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                  <Link
                    key={n}
                    href={'/products?' + query({ page: String(n) })}
                    className={'grid h-10 min-w-10 place-items-center rounded-xl text-xs font-bold ' + (n === page ? 'bg-violet-600 text-white shadow-lg shadow-violet-950/25' : 'border border-white/10 bg-white/[.035] text-slate-300 hover:bg-white/[.07]')}
                  >
                    {n}
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
