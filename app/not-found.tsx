import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070b16] px-6 text-white">
      <section className="zenvora-glass w-full max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.22em] text-fuchsia-400">404 · Zenvora</p>
        <h1 className="mt-3 text-4xl font-black">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">The page may have moved, the product may no longer be available, or the link may be incorrect.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/" className="rounded-xl bg-white px-5 py-3 text-sm font-black text-slate-950">Go home</Link>
          <Link href="/products" className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white">Browse products</Link>
        </div>
      </section>
    </main>
  );
}
