import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main-content" className="min-h-screen bg-[#070b16] px-4 py-16 text-white">
      <div className="container flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="text-7xl" aria-hidden="true">🛍️</div>
        <p className="mt-6 text-xs font-black uppercase tracking-[.22em] text-fuchsia-400">404</p>
        <h1 className="mt-2 text-4xl font-black sm:text-5xl">We couldn't find that page.</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
          The page may have moved, the product may no longer be available, or the link may be incorrect.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950 hover:-translate-y-0.5">Back to home</Link>
          <Link href="/products" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold hover:bg-white/10">Browse products</Link>
        </div>
      </div>
    </main>
  );
}
