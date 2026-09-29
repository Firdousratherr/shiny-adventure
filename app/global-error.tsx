'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body className="min-h-screen bg-[#070b16] text-white"><main className="grid min-h-screen place-items-center px-6"><section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center"><p className="text-xs font-black uppercase tracking-[.22em] text-rose-300">Zenvora</p><h1 className="mt-3 text-3xl font-black">A temporary error occurred</h1><p className="mt-3 text-sm text-slate-400">Please reload the application and try again.</p><button onClick={()=>reset()} className="mt-7 rounded-xl bg-white px-6 py-3 text-sm font-black text-slate-950">Reload</button></section></main></body></html>;
}
