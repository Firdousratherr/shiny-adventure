import Link from 'next/link';
import { auth } from '../../auth';
import { db } from '../../lib/db';
import StoreHeader from '../../components/store-header';
import StoreFooter from '../../components/store-footer';
import ProductCard from '../../components/product-card';

export default async function Products({ searchParams }: { searchParams: { q?: string; sort?: string; page?: string; category?: string } }) {
  const session = await auth();
  const loggedIn = !!session?.user?.email;
  const page = Math.max(1, Number(searchParams.page || 1) || 1);
  const size = 12;
  const q = searchParams.q?.trim();
  const category = searchParams.category?.trim();
  const searchTerms = q ? q.split(/\s+/).map(term => term.trim()).filter(Boolean).slice(0, 6) : [];
  const searchFilter = searchTerms.length
    ? { AND: searchTerms.map(term => ({ OR: [
        { name: { contains: term, mode: 'insensitive' as const } },
        { description: { contains: term, mode: 'insensitive' as const } },
        { category: { name: { contains: term, mode: 'insensitive' as const } } },
      ] })) }
    : {};
  const where = { status: 'ACTIVE' as const, ...searchFilter, ...(category ? { category: { slug: category } } : {}) };
  const orderBy = searchParams.sort === 'price-asc'
    ? { sellingPrice: 'asc' as const }
    : searchParams.sort === 'price-desc'
      ? { sellingPrice: 'desc' as const }
      : { createdAt: 'desc' as const };

  const [items, count, categories] = await Promise.all([
    db.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * size,
      take: size,
      select: { id:true, name:true, slug:true, sellingPrice:true, stock:true, category:{select:{name:true}}, images:{orderBy:{sortOrder:'asc'},take:1,select:{url:true,altText:true}} },
    }),
    db.product.count({ where }),
    db.category.findMany({ orderBy:{name:'asc'}, select:{name:true,slug:true}, take:30 }),
  ]);

  const pages = Math.ceil(count / size);
  const query = (extra: Record<string, string | undefined> = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (searchParams.sort) params.set('sort', searchParams.sort);
    if (category) params.set('category', category);
    for (const [k,v] of Object.entries(extra)) if (v) params.set(k,v);
    return params.toString();
  };

  return (
    <main id="main-content" className="store-shell">
      <StoreHeader loggedIn={loggedIn} />
      <div className="store-container py-7 sm:py-10">
        <div className="store-page-heading">
          <div>
            <p className="store-kicker">The collection</p>
            <h1 className="store-page-title">{q ? <>Results for <span className="store-gradient-text">{q}</span></> : 'Discover your next find'}</h1>
            <p className="mt-2 text-sm text-slate-500">{count.toLocaleString('en-IN')} products available{category ? ' in this category' : ''}.</p>
          </div>
          <div className="store-page-heading-art" aria-hidden="true"><span>✦</span><span>◈</span><span>◌</span></div>
        </div>

        <section className="store-filter-bar mt-7">
          <form action="/products" className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
            <label className="store-filter-search">
              <span className="sr-only">Search products</span>
              <input name="q" defaultValue={q} placeholder="Search products..." />
            </label>
            <select name="category" defaultValue={category || ''} className="store-filter-control">
              <option value="">All categories</option>
              {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select name="sort" defaultValue={searchParams.sort || ''} className="store-filter-control">
              <option value="">Newest</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
            <button className="store-filter-btn">Apply</button>
          </form>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <Link href={query({page:'1', category:undefined}) || '/products'} className={`store-filter-chip ${!category ? 'is-active' : ''}`}>All</Link>
            {categories.slice(0,10).map(c => <Link key={c.slug} href={query({category:c.slug,page:'1'})} className={`store-filter-chip ${category===c.slug ? 'is-active' : ''}`}>{c.name}</Link>)}
          </div>
        </section>

        {items.length === 0 ? (
          <div className="store-empty mt-8">
            <div className="store-empty-icon">⌕</div>
            <h2>No products found</h2>
            <p>Try a shorter search, another category, or clear your filters.</p>
            <Link href="/products" className="store-primary-btn mt-5">Clear filters <span>→</span></Link>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map(product => (
                <ProductCard key={product.id} product={{ ...product, image: product.images[0] || null }} />
              ))}
            </div>
            {pages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
                {page > 1 && <Link href={`/products?${query({page:String(page-1)})}`} className="store-page-btn">←</Link>}
                <span className="store-page-indicator">Page {page} of {pages}</span>
                {page < pages && <Link href={`/products?${query({page:String(page+1)})}`} className="store-page-btn">→</Link>}
              </nav>
            )}
          </>
        )}
      </div>
      <StoreFooter />
    </main>
  );
}
