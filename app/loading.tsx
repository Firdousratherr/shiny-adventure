export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#070b16] px-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-xl shadow-violet-900/30" />
        <p className="mt-5 text-sm font-bold text-slate-300">Loading Zenvora…</p>
        <div className="mx-auto mt-4 h-2 max-w-xs overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-white/30" />
        </div>
      </div>
    </main>
  );
}
