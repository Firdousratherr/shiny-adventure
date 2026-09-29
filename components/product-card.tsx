import Image from 'next/image';
import Link from 'next/link';
import AddToCart from './add-to-cart';
import { productImageUrl } from '../lib/product-image-url';

type Product = {
  id: string;
  name: string;
  slug: string;
  sellingPrice: unknown;
  stock: number;
  category?: { name: string } | null;
  images: { url: string; altText?: string | null }[];
};

export default function ProductCard({ product }: { product: Product }) {
  const price = Number(product.sellingPrice);

  return (
    <article className="zenvora-product-card group overflow-hidden">
      <Link href={'/product/' + product.slug} className="block">
        <div className="relative aspect-[4/4.2] overflow-hidden bg-[radial-gradient(circle_at_50%_35%,rgba(167,139,250,.18),transparent_50%),rgba(255,255,255,.025)]">
          <div className="absolute inset-0 opacity-0 transition duration-500 group-hover:opacity-100">
            <div className="absolute -right-16 -top-12 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
          </div>
          {product.images[0] ? (
            <div className="flex h-full w-full items-center justify-center p-5 sm:p-7">
              <img
                src={productImageUrl(product.images[0].url) || ''}
                alt={product.images[0].altText || product.name}
                className="h-full w-full object-contain transition duration-700 group-hover:scale-[1.07] group-hover:-rotate-1"
              />
            </div>
          ) : (
            <div className="grid h-full place-items-center text-6xl opacity-70">🛍️</div>
          )}

          <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
            <span className="rounded-full border border-white/10 bg-[#070b16]/75 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.14em] text-fuchsia-200 backdrop-blur-md">
              {product.category?.name || 'Zenvora'}
            </span>
            {product.stock > 0 && product.stock <= 5 ? (
              <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[9px] font-black text-slate-950">
                Only {product.stock} left
              </span>
            ) : null}
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="line-clamp-2 min-h-11 text-sm font-bold leading-5 sm:text-[15px]">{product.name}</h2>
            <span className="mt-0.5 shrink-0 text-slate-600 transition group-hover:text-violet-300">↗</span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[1.25rem] font-black tracking-tight">₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              <p className={'mt-1 text-[10px] font-bold ' + (product.stock > 0 ? 'text-emerald-300' : 'text-rose-300')}>
                {product.stock > 0 ? 'In stock' : 'Out of stock'}
              </p>
            </div>
            <span className="rounded-xl border border-white/10 bg-white/[.035] px-3 py-2 text-[10px] font-bold text-slate-300 transition group-hover:border-violet-400/30 group-hover:bg-violet-500/10 group-hover:text-white">
              View
            </span>
          </div>
        </div>
      </Link>

      <div className="border-t border-white/10 p-3.5 sm:p-4">
        <AddToCart
          product={{
            id: product.id,
            name: product.name,
            price,
            image: productImageUrl(product.images[0]?.url),
            stock: product.stock,
          }}
        />
      </div>
    </article>
  );
}
