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
  const image = productImageUrl(product.images[0]?.url);

  return (
    <article className="zenvora-product-card group">
      <Link href={'/product/' + product.slug} className="block">
        <div className="product-media relative aspect-[4/4.15] overflow-hidden p-5 sm:p-7">
          <div className="absolute left-4 top-4 rounded-full bg-violet-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-[.12em] text-violet-700">
            {product.category?.name || 'Zenvora pick'}
          </div>
          {product.stock > 0 && product.stock <= 5 ? <div className="absolute right-4 top-4 rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-black text-amber-800">Only {product.stock} left</div> : null}
          <div className="absolute inset-x-5 bottom-4 flex items-center justify-between opacity-0 transition duration-300 group-hover:opacity-100">
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-[9px] font-black uppercase tracking-wide text-violet-700 shadow-lg">Quick view</span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-violet-700 shadow-lg">↗</span>
          </div>
          {image ? (
            <img src={image} alt={product.images[0]?.altText || product.name} className="relative h-full w-full object-contain transition duration-700 group-hover:scale-[1.08] group-hover:-rotate-1" loading="lazy" />
          ) : (
            <div className="grid h-full place-items-center text-6xl text-violet-300">🛍️</div>
          )}
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-h-10 line-clamp-2 text-[14px] font-extrabold leading-5 text-slate-900 sm:text-[15px]">{product.name}</h2>
            <span className="mt-0.5 shrink-0 text-slate-300 transition group-hover:text-violet-600">↗</span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="product-price text-[1.2rem] font-black tracking-tight">₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
              <p className={'product-meta mt-1 text-[10px] font-bold ' + (product.stock > 0 ? 'text-emerald-600' : 'text-rose-500')}>{product.stock > 0 ? 'In stock · ready to ship' : 'Currently unavailable'}</p>
            </div>
            <span className="product-cta rounded-xl px-3 py-2 text-[10px] font-black">View</span>
          </div>
        </div>
      </Link>

      <div className="border-t border-slate-100 p-3.5 sm:p-4">
        <AddToCart product={{ id: product.id, name: product.name, price, image, stock: product.stock }} />
      </div>
    </article>
  );
}
