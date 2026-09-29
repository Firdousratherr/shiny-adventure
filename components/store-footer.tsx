import Link from 'next/link';

export default function StoreFooter() {
  return (
    <footer className="store-footer">
      <div className="store-container grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="store-logo">
            <span className="store-logo-mark">Z</span>
            <span>zenvora<span className="text-violet-600">.</span></span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">Thoughtfully selected everyday products, clear pricing and a smoother way to shop online.</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Secure shopping experience
          </div>
        </div>
        <div>
          <h3 className="store-footer-title">Shop</h3>
          <div className="mt-4 space-y-3 text-sm">
            <Link href="/products" className="store-footer-link">All products</Link>
            <Link href="/products?sort=price-desc" className="store-footer-link">Deals</Link>
            <Link href="/products" className="store-footer-link">Categories</Link>
          </div>
        </div>
        <div>
          <h3 className="store-footer-title">Help</h3>
          <div className="mt-4 space-y-3 text-sm">
            <Link href="/track" className="store-footer-link">Track order</Link>
            <Link href="/account" className="store-footer-link">My account</Link>
            <Link href="/login" className="store-footer-link">Sign in</Link>
          </div>
        </div>
        <div>
          <h3 className="store-footer-title">Zenvora</h3>
          <div className="mt-4 space-y-3 text-sm">
            <Link href="/admin/login" className="store-footer-link">Admin login</Link>
            <span className="store-footer-link cursor-default">Fast delivery across India</span>
            <span className="store-footer-link cursor-default">Secure payments</span>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-200">
        <div className="store-container flex flex-col gap-2 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Zenvora. All rights reserved.</span>
          <span>Shop smart. Live better.</span>
        </div>
      </div>
    </footer>
  );
}
