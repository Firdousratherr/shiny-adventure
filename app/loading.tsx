export default function Loading() {
  return (
    <main className="min-h-screen bg-[#070b16] px-4 py-8 text-white">
      <div className="container">
        <div className="zenvora-skeleton h-8 w-40" aria-hidden="true" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="zenvora-card overflow-hidden p-3">
              <div className="zenvora-skeleton aspect-square w-full" aria-hidden="true" />
              <div className="mt-4 zenvora-skeleton h-5 w-4/5" aria-hidden="true" />
              <div className="mt-3 zenvora-skeleton h-6 w-2/5" aria-hidden="true" />
            </div>
          ))}
        </div>
        <p className="sr-only" role="status" aria-live="polite">Loading Zenvora.</p>
      </div>
    </main>
  );
}
