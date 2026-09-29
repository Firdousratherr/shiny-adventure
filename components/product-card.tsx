import Link from 'next/link';
import { productImageUrl } from '../lib/product-image-url';

export default function ProductCard({
  product,
}: {
  product: {
    id: string;
    name: string;
    slug: string;
    sellingPrice: unknown;
    stock?: number;
    category?: { name: string } | null;
    image?: { url: string; altText?: string | null } | null;
  };
}) {
  const price = Number(product.sellingPrice);
  return (
    <Link href={`/product/${product.slug}`} className="store-product-card group">
      <div className="store-product-media">
        <div className="store-product-orb" aria-hidden="true" />
        {product.image ? (
          <img src={productImageUrl(product.image.url) || product.image.url} alt={product.image.altText || product.name} loading="lazy" decoding="async" />
        ) : (
          <div className="store-product-fallback">Z</div>
        )}
        <div className="store-product-badges">
          {product.category?.name && <span className="store-product-chip">{product.category.name}</span>}
          {typeof product.stock === 'number' && product.stock > 0 && product.stock <= 5 && <span className="store-product-stock">Only {product.stock} left</span>}
        </div>
        <span className="store-product-arrow" aria-hidden="true">↗</span>
      </div>
      <div className="p-4 sm:p-5">
        <h3 className="line-clamp-2 min-h-[44px] text-[15px] font-extrabold leading-5 text-slate-900">{product.name}</h3>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xl font-black tracking-tight text-slate-950">₹{price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            {typeof product.stock === 'number' && <p className={`mt-1 text-[11px] font-bold ${product.stock > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{product.stock > 0 ? 'In stock' : 'Out of stock'}</p>}
          </div>
          <span className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-extrabold text-slate-600 transition group-hover:bg-violet-50 group-hover:text-violet-700">View</span>
        </div>
      </div>
    </Link>
  );
}
