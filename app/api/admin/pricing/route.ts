import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '../../../../lib/db';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { recordAdminAudit } from '../../../../lib/admin-audit';

const providers = ['AMAZON','FLIPKART','MEESHO'] as const;
const scopes = ['GLOBAL','MARKETPLACE','CATEGORY'] as const;
const roundingModes = ['NONE','UP_TO_10','UP_TO_50','UP_TO_100','NEAREST_10','NEAREST_50','NEAREST_100'] as const;

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function providerFromUrl(url?: string | null) {
  if (!url) return null;
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (h.includes('amazon.')) return 'AMAZON';
    if (h.includes('flipkart.')) return 'FLIPKART';
    if (h.includes('meesho.')) return 'MEESHO';
  } catch {}
  return null;
}

function calculate(source: number, rule: any) {
  let value = source * (1 + Number(rule.markupPercent) / 100) + Number(rule.fixedAmount || 0);
  if (rule.minPrice != null) value = Math.max(value, Number(rule.minPrice));
  if (rule.maxPrice != null) value = Math.min(value, Number(rule.maxPrice));
  switch (rule.roundingMode) {
    case 'UP_TO_10': value = Math.ceil(value / 10) * 10; break;
    case 'UP_TO_50': value = Math.ceil(value / 50) * 50; break;
    case 'UP_TO_100': value = Math.ceil(value / 100) * 100; break;
    case 'NEAREST_10': value = Math.round(value / 10) * 10; break;
    case 'NEAREST_50': value = Math.round(value / 50) * 50; break;
    case 'NEAREST_100': value = Math.round(value / 100) * 100; break;
  }
  return Math.max(0, Number(value.toFixed(2)));
}

function validateRule(b: any) {
  const scope = String(b.scope || 'GLOBAL');
  if (!scopes.includes(scope as any)) throw new Error('Invalid pricing scope.');
  const markupPercent = num(b.markupPercent, NaN);
  const fixedAmount = num(b.fixedAmount, 0);
  if (!Number.isFinite(markupPercent) || markupPercent < -100 || markupPercent > 10000) throw new Error('Markup must be between -100% and 10000%.');
  if (!Number.isFinite(fixedAmount) || fixedAmount < 0) throw new Error('Fixed amount must be non-negative.');
  const roundingMode = String(b.roundingMode || 'NONE');
  if (!roundingModes.includes(roundingMode as any)) throw new Error('Invalid rounding mode.');
  const provider = b.provider ? String(b.provider).toUpperCase() : null;
  if (scope === 'MARKETPLACE' && !providers.includes(provider as any)) throw new Error('Marketplace rules require Amazon, Flipkart or Meesho.');
  if (scope !== 'MARKETPLACE' && provider) throw new Error('Provider is only valid for marketplace rules.');
  if (scope === 'CATEGORY' && !b.categoryId) throw new Error('Category rules require a category.');
  return { scope, provider, categoryId: b.categoryId ? String(b.categoryId) : null, markupPercent, fixedAmount, minPrice: b.minPrice === '' || b.minPrice == null ? null : num(b.minPrice, NaN), maxPrice: b.maxPrice === '' || b.maxPrice == null ? null : num(b.maxPrice, NaN), roundingMode, enabled: b.enabled !== false, priority: Math.trunc(num(b.priority, 0)) };
}

async function access() {
  return requireAdminPermission('pricing');
}

export async function GET() {
  const admin = await access();
  if (!admin) return NextResponse.json({ error: 'Pricing permission required.' }, { status: 403 });
  const [rules, categories, products] = await Promise.all([
    db.pricingRule.findMany({ orderBy: [{priority:'desc'},{createdAt:'asc'}], include: { category: true } }),
    db.category.findMany({ orderBy: { name: 'asc' } }),
    db.product.findMany({ orderBy: { updatedAt: 'desc' }, take: 500, select: { id:true,name:true,sourceUrl:true,sourceCost:true,sellingPrice:true,priceLocked:true,priceLockValue:true,category:true,updatedAt:true } }),
  ]);
  return NextResponse.json({ rules, categories, products });
}

export async function POST(request: Request) {
  const admin = await access();
  if (!admin) return NextResponse.json({ error: 'Pricing permission required.' }, { status: 403 });
  try {
    const b = await request.json();
    if (b.action === 'lock') {
      const id = String(b.productId || '');
      const product = await db.product.findUnique({ where: { id }, select: { id:true,name:true,sellingPrice:true } });
      if (!product) return NextResponse.json({ error:'Product not found.' }, { status:404 });
      const lockedPrice = b.price === '' || b.price == null ? Number(product.sellingPrice) : num(b.price, NaN);
      if (!Number.isFinite(lockedPrice) || lockedPrice < 0) return NextResponse.json({ error:'Invalid locked price.' }, {status:400});
      const updated = await db.product.update({ where:{id}, data:{priceLocked:true,priceLockValue:new Prisma.Decimal(lockedPrice)} });
      await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRICE_LOCKED',entityType:'PRODUCT',entityId:id,details:{price:lockedPrice}});
      return NextResponse.json({product:updated});
    }
    if (b.action === 'unlock') {
      const id = String(b.productId || '');
      const updated = await db.product.update({ where:{id}, data:{priceLocked:false,priceLockValue:null} });
      await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRICE_UNLOCKED',entityType:'PRODUCT',entityId:id});
      return NextResponse.json({product:updated});
    }
    if (b.action === 'apply') {
      const ids = Array.isArray(b.productIds) ? b.productIds.map(String).slice(0,500) : [];
      const products = await db.product.findMany({ where: ids.length ? {id:{in:ids}} : {}, take:500, select:{id:true, name:true, sourceUrl:true, sourceCost:true, sellingPrice:true, priceLocked:true, priceLockValue:true, categoryId:true} }).catch(async()=>db.product.findMany({ where: ids.length ? {id:{in:ids}} : {}, take:500, select:{id:true,name:true,sourceUrl:true,sourceCost:true,sellingPrice:true,priceLocked:true,priceLockValue:true,categoryId:true} }));
      const rules = await db.pricingRule.findMany({ where:{enabled:true}, orderBy:[{priority:'desc'},{createdAt:'asc'}] });
      let updatedCount=0, skippedLocked=0, skippedNoSource=0;
      for (const p of products) {
        if (p.priceLocked) { skippedLocked++; continue; }
        if (p.sourceCost == null) { skippedNoSource++; continue; }
        const provider = providerFromUrl(p.sourceUrl);
        const rule = rules.find(r => r.scope==='CATEGORY' && r.categoryId===p.categoryId) ||
          (provider ? rules.find(r=>r.scope==='MARKETPLACE' && r.provider===provider) : null) ||
          rules.find(r=>r.scope==='GLOBAL');
        if (!rule) continue;
        const next = calculate(Number(p.sourceCost), rule);
        if (next === Number(p.sellingPrice)) continue;
        await db.$transaction([
          db.product.update({where:{id:p.id},data:{sellingPrice:new Prisma.Decimal(next)}}),
          db.productPriceHistory.create({data:{productId:p.id,sourceCost:p.sourceCost,oldSellingPrice:p.sellingPrice,newSellingPrice:new Prisma.Decimal(next),markupPercent:rule.markupPercent,reason:'AUTOMATIC_MARKUP',changedBy:admin.email}})
        ]);
        updatedCount++;
      }
      await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRICES_RECALCULATED',entityType:'PRICING_RULE',details:{updatedCount,skippedLocked,skippedNoSource}});
      return NextResponse.json({updatedCount,skippedLocked,skippedNoSource});
    }
    const v = validateRule(b);
    if (v.minPrice != null && !Number.isFinite(v.minPrice)) throw new Error('Invalid minimum price.');
    if (v.maxPrice != null && !Number.isFinite(v.maxPrice)) throw new Error('Invalid maximum price.');
    const rule = await db.pricingRule.create({data:{name:String(b.name||'Pricing rule').slice(0,100),...v,markupPercent:new Prisma.Decimal(v.markupPercent),fixedAmount:new Prisma.Decimal(v.fixedAmount),minPrice:v.minPrice==null?null:new Prisma.Decimal(v.minPrice),maxPrice:v.maxPrice==null?null:new Prisma.Decimal(v.maxPrice)}});
    await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRICING_RULE_CREATED',entityType:'PRICING_RULE',entityId:rule.id,details:{name:rule.name,scope:rule.scope,markupPercent:rule.markupPercent.toString()}});
    return NextResponse.json({rule},{status:201});
  } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:'Unable to create pricing rule.'},{status:400}); }
}

export async function PATCH(request: Request) {
  const admin = await access();
  if (!admin) return NextResponse.json({ error: 'Pricing permission required.' }, { status: 403 });
  try {
    const b = await request.json();
    const id = String(b.id || '');
    if (!id) return NextResponse.json({error:'Rule ID required.'},{status:400});
    const v = validateRule(b);
    const rule = await db.pricingRule.update({where:{id},data:{name:String(b.name||'Pricing rule').slice(0,100),...v,markupPercent:new Prisma.Decimal(v.markupPercent),fixedAmount:new Prisma.Decimal(v.fixedAmount),minPrice:v.minPrice==null?null:new Prisma.Decimal(v.minPrice),maxPrice:v.maxPrice==null?null:new Prisma.Decimal(v.maxPrice)}});
    await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRICING_RULE_UPDATED',entityType:'PRICING_RULE',entityId:id,details:{name:rule.name,markupPercent:rule.markupPercent.toString(),enabled:rule.enabled}});
    return NextResponse.json({rule});
  } catch(e) { return NextResponse.json({error:e instanceof Error?e.message:'Unable to update pricing rule.'},{status:400}); }
}

export async function DELETE(request: Request) {
  const admin = await access();
  if (!admin) return NextResponse.json({ error: 'Pricing permission required.' }, { status: 403 });
  try {
    const {id} = await request.json();
    await db.pricingRule.delete({where:{id:String(id)}});
    await recordAdminAudit({adminId:admin.id,adminEmail:admin.email,action:'PRICING_RULE_DELETED',entityType:'PRICING_RULE',entityId:String(id)});
    return NextResponse.json({ok:true});
  } catch(e) { return NextResponse.json({error:'Unable to delete pricing rule.'},{status:400}); }
}
