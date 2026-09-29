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
    ...(q ? { OR: [
      { name: { contains: q, mode: 'insensitive' as const } },
      { description: { contains: q, mode: 'insensitive' as const } },
      { category: { name: { contains: q, mode: 'insensitive' as const } } },
    ] } : {}),
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
        id: true, name: true, slug: true, sellingPrice: true, stock: true,
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
    <main className="store-dark min-h-screen pb-28 sm:pb-0">
      <StoreHeader loggedIn={loggedIn} searchValue={q || ''} />

      <div className="container py-8 sm:py-11">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-[#171047] via-[#4b2ab7] to-[#8b3fe5] p-6 text-white shadow-2xl shadow-violet-500/10 sm:p-8">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />
          <div className="absolute bottom-[-110px] left-[28%] h-64 w-64 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-violet-100">Zenvora marketplace</span>
              <h1 className="mt-4 text-4xl font-black tracking-[-.045em] sm:text-5xl">Find your next favorite.</h1>
              <p className="mt-3 text-sm leading-6 text-violet-100/80">{count} products available{q ? ' for "' + q + '"' : ''}. Search, filter by category and sort by price.</p>
            </div>
            <Link href="/cart" className="rounded-full bg-white px-5 py-3 text-xs font-black text-violet-800 shadow-lg shadow-black/15 hover:-translate-y-0.5">View cart →</Link>
          </div>
        </section>

        <div className="mt-7 grid gap-5 lg:grid-cols-[250px_1fr]">
          <aside className="zenvora-filter-panel h-fit lg:sticky lg:top-28">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-fuchsia-600">Refine</p><h2 className="mt-1 text-base font-black text-slate-900">Browse smarter</h2></div>
              <Link href="/products" className="text-[10px] font-black text-violet-700">Reset</Link>
            </div>

            <form action="/products" className="mt-5 space-y-4">
              <label className="block text-xs font-black text-slate-600">Search<input name="q" defaultValue={q} placeholder="Search products..." className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" /></label>
              <label className="block text-xs font-black text-slate-600">Category<select name="category" defaultValue={category || ''} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"><option value="">All categories</option>{categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
              <label className="block text-xs font-black text-slate-600">Sort by<select name="sort" defaultValue={searchParams.sort || ''} className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10"><option value="">Newest</option><option value="price-asc">Price: low → high</option><option value="price-desc">Price: high → low</option></select></label>
              <button className="w-full rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-500 px-4 py-3 text-xs font-black text-white shadow-lg shadow-violet-500/20 hover:-translate-y-0.5">Apply filters →</button>
            </form>

            <div className="mt-5 rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-violet-700">Shopping basics</p>
              <div className="mt-3 space-y-2 text-xs font-semibold text-slate-600"><p>✓ Secure checkout</p><p>✓ Clear product pricing</p><p>✓ Helpful support</p></div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-500"><span className="font-black text-slate-900">{count}</span> results</p>
              {category ? <span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-black text-violet-700">#{category}</span> : <span className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Fresh selection</span>}
            </div>

            {items.length === 0 ? (
              <div className="zenvora-empty-state mt-4">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-violet-50 text-2xl text-violet-700">⌕</div>
                <p className="mt-4 text-lg font-black text-slate-900">No products found</p>
                <p className="mt-2 text-sm text-slate-500">Try a different search term or clear your filters.</p>
                <Link href="/products" className="mt-5 inline-flex rounded-full bg-violet-700 px-5 py-3 text-sm font-black text-white">Clear filters</Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map(product => <ProductCard key={product.id} product={product} />)}
              </div>
            )}

            {pages > 1 ? (
              <div className="mt-9 flex flex-wrap justify-center gap-2">
                {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
                  <Link key={n} href={'/products?' + query({ page: String(n) })} className={'grid h-10 min-w-10 place-items-center rounded-xl text-xs font-black ' + (n === page ? 'bg-gradient-to-r from-violet-700 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20' : 'border border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700')}>{n}</Link>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
