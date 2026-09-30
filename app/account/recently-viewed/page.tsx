import Link from 'next/link';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import StoreHeader from '../../../components/store-header';
import ProductCard from '../../../components/product-card';

export default async function RecentlyViewedPage() {
  const session = await auth();
  if (session?.user?.role !== 'customer' || !session.user.email) {
    return <main className="store-dark min-h-screen"><StoreHeader /><div className="container py-16"><div className="zenvora-empty-state mx-auto max-w-lg"><h1 className="text-2xl font-black">Sign in to view recently viewed</h1><p className="mt-2 text-sm text-slate-500">Sign in so Zenvora can keep your browsing history with your account.</p><Link href="/login?callbackUrl=/account/recently-viewed" className="mt-6 inline-flex rounded-xl bg-violet-700 px-6 py-3 font-black text-white">Sign in</Link></div></div></main>;
  }

  const rows = await db.recentlyViewed.findMany({
    where: { user: { email: session.user.email } },
    orderBy: { viewedAt: 'desc' },
    take: 30,
    distinct: ['productId'],
    select: { viewedAt: true, product: { select: {
      id: true, name: true, slug: true, sellingPrice: true, stock: true,
      category: { select: { name: true } },
      images: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true, altText: true } },
    } } },
  });

  return <main className="store-dark min-h-screen pb-28 sm:pb-10">
    <StoreHeader loggedIn />
    <div className="container py-8 sm:py-10">
      <div className="zenvora-page-hero">
        <div>
          <span className="inline-flex rounded-full border bg-cyan-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-cyan-700">Browsing history</span>
          <h1 className="mt-4 text-4xl font-black tracking-[-.04em] sm:text-5xl">Recently viewed</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Pick up where you left off without searching again.</p>
        </div>
        <Link href="/products" className="hidden rounded-full border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-600 hover:border-violet-300 hover:text-violet-700 sm:inline-flex">Browse all products →</Link>
      </div>
      {rows.length ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{rows.map((row) => <ProductCard key={row.product.id} product={row.product} />)}</div> :
        <div className="zenvora-empty-state mt-8"><div className="text-5xl">◌</div><p className="mt-4 text-lg font-black">Nothing here yet</p><p className="mt-2 text-sm text-slate-500">Products you view will appear here after you browse the store.</p><Link href="/products" className="mt-5 inline-flex rounded-xl bg-violet-700 px-5 py-3 text-xs font-black text-white">Start browsing →</Link></div>}
    </div>
  </main>;
}
