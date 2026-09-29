'use client';

import Image from 'next/image';
import { useState } from 'react';
import { productImageUrl } from '../lib/product-image-url';

type ImageItem = { url: string; altText?: string | null };

export default function ProductGallery({ images, name, stock }: { images: ImageItem[]; name: string; stock: number }) {
  const [selected, setSelected] = useState(0);
  const active = images[selected];

  return (
    <div>
      <div className="zenvora-product-gallery relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[.03] p-2 sm:rounded-[32px] sm:p-3">
        <div className="relative aspect-square overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_50%_38%,rgba(167,139,250,.18),transparent_48%),rgba(255,255,255,.025)] sm:rounded-[26px]">
          {active ? (
            <Image
              src={productImageUrl(active.url) || ''}
              alt={active.altText || name}
              fill
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-contain p-5 transition duration-500 hover:scale-[1.025] sm:p-10"
            />
          ) : (
            <div className="grid h-full place-items-center text-8xl opacity-70">🛍️</div>
          )}

          <div className="pointer-events-none absolute inset-x-4 top-4 flex items-center justify-between gap-3">
            <span className="rounded-full border border-white/10 bg-[#070b16]/75 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-slate-200 backdrop-blur-md">Product preview</span>
            {stock > 0 && stock <= 5 ? <span className="rounded-full bg-amber-300 px-3 py-1.5 text-[10px] font-black text-slate-950">Only {stock} left</span> : null}
          </div>
        </div>
      </div>

      {images.length > 1 ? (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
          {images.slice(0, 5).map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={'Show image ' + (index + 1)}
              aria-pressed={selected === index}
              className={'aspect-square overflow-hidden rounded-2xl border bg-white/[.03] transition ' + (selected === index ? 'border-violet-400/70 ring-2 ring-violet-500/15' : 'border-white/10 hover:border-white/20')}
            >
              <Image src={productImageUrl(image.url) || ''} alt="" fill sizes="96px" className="object-contain p-2" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
