import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';
import { recordAdminAudit } from '../../../../lib/admin-audit';

async function admin() { return requireAdminPermission('products'); }
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
const price = (v: unknown) => { if (typeof v !== 'string' && typeof v !== 'number') return null; try { const d = new Prisma.Decimal(String(v)); return d.isFinite() && !d.isNegative() ? d : null; } catch { return null; } };
const validStatus = (v: unknown): v is 'DRAFT'|'ACTIVE'|'HIDDEN'|'OUT_OF_STOCK' => typeof v === 'string' && ['DRAFT','ACTIVE','HIDDEN','OUT_OF_STOCK'].includes(v);

export async function POST(request: Request) {
  const adminAccess = await admin();
  if (!adminAccess) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const b = await request.json();
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 200) : '';
    const description = typeof b.description === 'string' ? b.description.trim().slice(0, 10000) : null;
    const slug = slugify(typeof b.slug === 'string' && b.slug.trim() ? b.slug : name);
    const sellingPrice = price(b.sellingPrice);
    const sourceCost = b.sourceCost === undefined || b.sourceCost === '' || b.sourceCost === null ? null : price(b.sourceCost);
    const stock = Number(b.stock);
    if (!name || !slug || !sellingPrice || (b.sourceCost !== undefined && b.sourceCost !== '' && b.sourceCost !== null && !sourceCost)) return NextResponse.json({ error: 'Name, valid selling price, slug and source cost are required.' }, { status: 400 });
    if (!Number.isSafeInteger(stock) || stock < 0) return NextResponse.json({ error: 'Stock must be a non-negative integer.' }, { status: 400 });
    const status = validStatus(b.status) ? b.status : 'DRAFT';
    if (status === 'ACTIVE' && stock === 0) return NextResponse.json({ error: 'An active product must have stock greater than zero.' }, { status: 400 });
    if (!adminAccess.isSuperAdmin) {
      if (!(await requireAdminPermission('pricing'))) return NextResponse.json({ error: 'Pricing permission required.' }, { status: 403 });
      if (!(await requireAdminPermission('inventory'))) return NextResponse.json({ error: 'Inventory permission required.' }, { status: 403 });
    }
    const product = await db.product.create({ data: { name, slug, description, sellingPrice, sourceCost, stock, categoryId: typeof b.categoryId === 'string' && b.categoryId ? b.categoryId : null, featured: b.featured === true, status } });
    await recordAdminAudit({ adminId: adminAccess.id, adminEmail: adminAccess.email, action: 'PRODUCT_CREATED', entityType: 'PRODUCT', entityId: product.id, details: { name: product.name, sellingPrice: product.sellingPrice.toString(), stock: product.stock } });
    return NextResponse.json({ product }, { status: 201 });
  } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return NextResponse.json({ error: 'A product with this slug already exists.' }, { status: 409 }); console.error(e); return NextResponse.json({ error: 'Unable to create product.' }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  if (!(await admin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const b = await request.json();
    const adminAccess = await requireAdminPermission('products');
    if (!adminAccess) return NextResponse.json({ error: 'Products permission required.' }, { status: 403 });
    if (b.stock !== undefined) { const inventory = await requireAdminPermission('inventory'); if (!inventory) return NextResponse.json({ error: 'Inventory permission required.' }, { status: 403 }); }
    const id = typeof b.id === 'string' ? b.id : '';
    if (!id) return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
    const data: Prisma.ProductUpdateInput = {};
    if (b.name !== undefined) { if (typeof b.name !== 'string' || !b.name.trim()) return NextResponse.json({ error: 'Product name is required.' }, { status: 400 }); data.name = b.name.trim().slice(0, 200); }
    if (b.description !== undefined) data.description = typeof b.description === 'string' ? b.description.trim().slice(0, 10000) || null : null;
    if (b.categoryId !== undefined) data.category = b.categoryId ? { connect: { id: String(b.categoryId) } } : { disconnect: true };
    if (b.slug !== undefined) { const slug = slugify(String(b.slug)); if (!slug) return NextResponse.json({ error: 'Invalid slug.' }, { status: 400 }); data.slug = slug; }
    if (b.sellingPrice !== undefined) { const p = price(b.sellingPrice); if (!p) return NextResponse.json({ error: 'Invalid selling price.' }, { status: 400 }); data.sellingPrice = p; }
    if (b.sourceCost !== undefined) { const p = b.sourceCost === '' || b.sourceCost === null ? null : price(b.sourceCost); if (b.sourceCost !== '' && b.sourceCost !== null && !p) return NextResponse.json({ error: 'Invalid source cost.' }, { status: 400 }); data.sourceCost = p; }
    if (b.stock !== undefined) { const n = Number(b.stock); if (!Number.isSafeInteger(n) || n < 0) return NextResponse.json({ error: 'Invalid stock.' }, { status: 400 }); data.stock = n; }
    if (b.featured !== undefined) { if (typeof b.featured !== 'boolean') return NextResponse.json({ error: 'Invalid featured value.' }, { status: 400 }); data.featured = b.featured; }
    if (b.status !== undefined) { if (!validStatus(b.status)) return NextResponse.json({ error: 'Invalid product status.' }, { status: 400 }); data.status = b.status; }
    const currentProduct = await db.product.findUnique({ where: { id }, select: { stock: true, status: true, sellingPrice: true, sourceCost: true, name: true } });
    const current = currentProduct;

    if (!current) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    const actualPriceChange =
      (data.sellingPrice !== undefined && String(data.sellingPrice) !== current.sellingPrice.toString()) ||
      (data.sourceCost !== undefined && (data.sourceCost === null ? current.sourceCost !== null : String(data.sourceCost) !== (current.sourceCost?.toString() ?? '')));
    if (actualPriceChange) {
      const pricing = await requireAdminPermission('pricing');
      if (!pricing) return NextResponse.json({ error: 'Pricing permission required.' }, { status: 403 });
    }
    const isStaffPriceChange = actualPriceChange && !adminAccess.isSuperAdmin;
    if (isStaffPriceChange) {
      const approval = await db.adminApproval.create({
        data: {
          requestedById: adminAccess.id,
          requestedBy: adminAccess.email,
          action: 'PRICE_CHANGE',
          entityType: 'PRODUCT',
          entityId: id,
          payload: {
            sellingPrice: data.sellingPrice ? String(data.sellingPrice) : undefined,
            sourceCost: data.sourceCost === null ? null : data.sourceCost ? String(data.sourceCost) : undefined,
          },
        },
      });
      await recordAdminAudit({ adminId: adminAccess.id, adminEmail: adminAccess.email, action: 'PRICE_CHANGE_REQUESTED', entityType: 'PRODUCT', entityId: id, details: { approvalId: approval.id, productName: current.name } });
      return NextResponse.json({ pendingApproval: true, approvalId: approval.id, message: 'Price change submitted for Super Admin approval.' }, { status: 202 });
    }
    const nextStock = typeof data.stock === 'number' ? data.stock : current.stock;
    const nextStatus = typeof data.status === 'string' ? data.status : current.status;
    if (nextStatus === 'ACTIVE' && nextStock === 0) return NextResponse.json({ error: 'An active product must have stock greater than zero.' }, { status: 400 });
    const product = await db.product.update({ where: { id }, data });
    await recordAdminAudit({
      adminId: adminAccess.id,
      adminEmail: adminAccess.email,
      action: 'PRODUCT_UPDATED',
      entityType: 'PRODUCT',
      entityId: product.id,
      details: {
        changedFields: Object.keys(data),
        before: { sellingPrice: current.sellingPrice.toString(), sourceCost: current.sourceCost?.toString() ?? null, stock: current.stock },
        after: { sellingPrice: product.sellingPrice.toString(), sourceCost: product.sourceCost?.toString() ?? null, stock: product.stock },
      },
    });
    return NextResponse.json({ product });
  } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return NextResponse.json({ error: 'Slug already exists.' }, { status: 409 }); console.error(e); return NextResponse.json({ error: 'Unable to update product.' }, { status: 500 }); }
}
