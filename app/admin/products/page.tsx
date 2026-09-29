import Link from 'next/link';
import AdminNav from '../../../components/admin-nav';
import { redirect } from 'next/navigation';
import { requireAdminPermission } from '../../../lib/admin-access';
import { db } from '../../../lib/db';
import ProductAdmin from './product-admin';
import { productImageUrl } from '../../../lib/product-image-url';

export default async function ProductsAdmin({ searchParams }: { searchParams?: { import?: string } }) {
  const s = await requireAdminPermission('products');
  if (!s) redirect('/admin/login');

  const [products, categories] = await Promise.all([
    db.product.findMany({
      orderBy: { createdAt: 'desc' },
      include: { category: true, images: { orderBy: { sortOrder: 'asc' } } },
      take: 200,
    }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const counts = new Map<string, number>();
  for (const product of products) {
    if (product.categoryId) counts.set(product.categoryId, (counts.get(product.categoryId) || 0) + 1);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <AdminNav active={searchParams?.import === "1" ? "direct-import" : "products"} />
      <div className="container py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Zenvora Admin</p>
            <h1 className="text-3xl font-black tracking-tight">Products & categories</h1>
          </div>
          <Link href="/admin/dashboard" className="font-semibold">← Dashboard</Link>
        </div>

        <ProductAdmin
          initialProducts={products.map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            description: p.description || '',
            metaTitle: p.metaTitle || '',
            metaDescription: p.metaDescription || '',
            canonicalUrl: p.canonicalUrl || '',
            sellingPrice: p.sellingPrice.toString(),
            sourceCost: p.sourceCost?.toString() || '',
            stock: p.stock,
            categoryId: p.categoryId || '',
            categoryName: p.category?.name || '',
            featured: p.featured,
            status: p.status,
            images: p.images.map(i => ({
              id: i.id,
              url: productImageUrl(i.url) || '',
              altText: i.altText || '',
              sortOrder: i.sortOrder,
            })),
          }))}
          categories={categories.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            productCount: counts.get(c.id) || 0,
          }))}
        />
      </div>
    </main>
  );
}
