'use client';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#070b16] px-6 text-white"><section className="zenvora-glass w-full max-w-lg rounded-3xl p-8 text-center sm:p-10"><p className="text-xs font-black uppercase tracking-[.22em] text-rose-300">Something went wrong</p><h1 className="mt-3 text-3xl font-black">We could not load this page</h1><p className="mt-3 text-sm leading-6 text-slate-400">Please try again.</p><button onClick={()=>reset()} className="mt-7 rounded-xl bg-white px-6 py-3 text-sm font-black text-slate-950">Try again</button></section></main>;
}
