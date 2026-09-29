'use client';

import { useState } from 'react';

type ImageItem = { url: string; alt: string };

export default function ProductGallery({
  images,
  name,
  stock,
}: {
  images: ImageItem[];
  name: string;
  stock: number;
}) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const current = images[active];

  if (!images.length) {
    return <div className="zenvora-glass flex aspect-square items-center justify-center rounded-3xl bg-white/5 text-8xl">🛍️</div>;
  }

  return (
    <>
      <div className="zenvora-glass overflow-hidden rounded-3xl p-2 sm:p-3">
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="group relative block aspect-square w-full overflow-hidden rounded-2xl bg-white/5"
          aria-label="Open product image larger"
        >
          <img src={current.url} alt={current.alt} loading="eager" decoding="async" className="h-full w-full object-contain p-3 transition duration-500 group-hover:scale-[1.035] sm:p-6" />
          <span className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-[#070b16]/75 px-3 py-1.5 text-[10px] font-bold text-slate-300 backdrop-blur">Tap to enlarge</span>
          {stock > 0 && stock <= 5 && <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950">Only {stock} left</span>}
        </button>
      </div>

      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6" role="list" aria-label="Product images">
          {images.slice(0, 6).map((image, index) => (
            <button
              key={image.url + index}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === active}
              className={`overflow-hidden rounded-xl border bg-white/5 transition hover:-translate-y-0.5 ${index === active ? 'border-violet-400/80 ring-2 ring-violet-500/20' : 'border-white/10'}`}
            >
              <img src={image.url} alt="" loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Larger image of ${name}`} onClick={() => setZoom(false)}>
          <button type="button" onClick={() => setZoom(false)} className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-black text-white" aria-label="Close image">✕</button>
          <img src={current.url} alt={current.alt} className="max-h-[90vh] max-w-[95vw] object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
