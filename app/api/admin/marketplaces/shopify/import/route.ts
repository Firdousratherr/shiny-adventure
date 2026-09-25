import { NextResponse } from 'next/server';
import { db } from '../../../../../../lib/db';
import { requireAdminPermission } from '../../../../../../lib/admin-access';
import { credentialStatus, marketplaceCredentials, importItems, previewItems, type ImportMode, type SyncItem } from '../../../../../../lib/marketplaces';
import { getShopifyAccessToken } from '../../../../../../lib/shopify';

function graphQLErrorMessage(errors: unknown) {
  if (Array.isArray(errors)) return errors.map((e: any) => String(e?.message || e)).join('; ');
  if (errors && typeof errors === 'object') return Object.values(errors as Record<string, unknown>).map((e: any) => String(e?.message || e)).join('; ');
  return '';
}

const QUERY='query ProductsByIds($ids:[ID!]!) { nodes(ids:$ids) { ... on Product { id title descriptionHtml vendor productType onlineStoreUrl totalInventory images(first:20){nodes{url}} variants(first:100){nodes{id title sku barcode price compareAtPrice inventoryQuantity}} collections(first:10){nodes{id title handle}} } } }';

export async function POST(request:Request){
  const admin=await requireAdminPermission('marketplaces');
  if(!admin)return NextResponse.json({error:'Marketplace permission required.'},{status:403});
  try{
    if(!(await credentialStatus('SHOPIFY')))return NextResponse.json({error:'Shopify is not configured.'},{status:409});
    const body=await request.json();
    const productIds=Array.isArray(body.productIds)
      ? Array.from(new Set(body.productIds.filter((x:any)=>typeof x==='string'&&x.trim()).map((x:string)=>x.trim()))).slice(0,100)
      : [];
    if(!productIds.length)return NextResponse.json({error:'No Shopify products selected.'},{status:400});
    const markup=Number(body.markupPercent??0), fixed=Number(body.fixedAmount??0);
    if(!Number.isFinite(markup)||markup<0||markup>10000||!Number.isFinite(fixed)||fixed<0||fixed>10000000)
      return NextResponse.json({error:'Invalid pricing settings.'},{status:400});
    const mode: ImportMode = ['CREATE_ONLY','UPDATE_ONLY','CREATE_AND_UPDATE'].includes(String(body.mode))
      ? String(body.mode) as ImportMode
      : 'CREATE_AND_UPDATE';
    const roundingMode = ['NONE','NEAREST','UP','DOWN'].includes(String(body.roundingMode))
      ? String(body.roundingMode) as 'NONE'|'NEAREST'|'UP'|'DOWN'
      : 'NONE';
    const numericOrUndefined = (value: unknown) => {
      if (value === null || value === undefined || value === '') return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    };
    const rules = {
      mode,
      markupPercent: markup,
      fixedAmount: fixed,
      skipExisting: Boolean(body.skipExisting),
      skipOutOfStock: Boolean(body.skipOutOfStock),
      skipWithoutImages: Boolean(body.skipWithoutImages),
      skipWithoutPrice: Boolean(body.skipWithoutPrice),
      minSourcePrice: numericOrUndefined(body.minSourcePrice),
      maxSourcePrice: numericOrUndefined(body.maxSourcePrice),
      minInventory: numericOrUndefined(body.minInventory),
      roundingMode,
      roundingValue: numericOrUndefined(body.roundingValue),
      minSellingPrice: numericOrUndefined(body.minSellingPrice),
      maxSellingPrice: numericOrUndefined(body.maxSellingPrice),
      protectLockedPrice: body.protectLockedPrice !== false,
      updatePrice: body.updatePrice !== false,
      importImages: body.importImages !== false,
      importDescriptions: body.importDescriptions !== false,
      importInventory: body.importInventory !== false,
    };
    if ((rules.minSourcePrice !== undefined && rules.maxSourcePrice !== undefined && rules.minSourcePrice > rules.maxSourcePrice) ||
        (rules.minSellingPrice !== undefined && rules.maxSellingPrice !== undefined && rules.minSellingPrice > rules.maxSellingPrice)) {
      return NextResponse.json({error:'Minimum price cannot exceed maximum price.'},{status:400});
    }
    if (rules.roundingMode !== 'NONE' && (!rules.roundingValue || rules.roundingValue <= 0)) {
      return NextResponse.json({error:'Rounding value must be greater than zero.'},{status:400});
    }

    const integration=await db.marketplaceIntegration.upsert({where:{provider:'SHOPIFY'},update:{},create:{provider:'SHOPIFY'}});
    const {domain,accessToken}=await getShopifyAccessToken(await marketplaceCredentials('SHOPIFY'));
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),20000);
    let j:any;
    try{
      const r=await fetch('https://'+domain+'/admin/api/2026-07/graphql.json',{
        method:'POST',
        headers:{'Content-Type':'application/json','X-Shopify-Access-Token':accessToken},
        body:JSON.stringify({query:QUERY,variables:{ids:productIds}}),
        signal:controller.signal,
        cache:'no-store'
      });
      j=await r.json();
      if(j.errors)throw new Error(graphQLErrorMessage(j.errors)||'Shopify GraphQL request failed');
      if(!r.ok){const reason=typeof j?.error==='string'?j.error:typeof j?.message==='string'?j.message:'';throw new Error('Shopify Admin API returned HTTP '+r.status+(reason?': '+reason:''));}
    }finally{clearTimeout(timer);}

    const items:SyncItem[]=(j.data?.nodes||[]).filter(Boolean).map((x:any)=>({
      externalId:x.id,title:x.title,sourceUrl:x.onlineStoreUrl||null,
      sourceCost:Number(x.variants?.nodes?.[0]?.price||0)||null,
      imageUrl:x.images?.nodes?.[0]?.url||null,rawData:x
    }));
    const missing=productIds.length-items.length;
    const savedSettings = integration.settings && typeof integration.settings === 'object' && !Array.isArray(integration.settings)
      ? integration.settings as Record<string, unknown>
      : {};
    const categoryMappings = savedSettings.categoryMappings && typeof savedSettings.categoryMappings === 'object' && !Array.isArray(savedSettings.categoryMappings)
      ? savedSettings.categoryMappings as Record<string, string>
      : undefined;
    const importSettings = {
      ...rules,
      categoryMappings,
      maxItemsPerSync: items.length,
      automatic:false,
      changedBy:admin.email||'ADMIN',
    };
    if (body.preview === true) {
      const preview = await previewItems(integration.id, 'SHOPIFY', items, importSettings);
      const summary = preview.reduce<{ total: number; create: number; update: number; skip: number }>((acc, row) => {
        acc.total++;
        if (row.action === 'CREATE') acc.create++;
        else if (row.action === 'UPDATE') acc.update++;
        else acc.skip++;
        return acc;
      }, { total:0, create:0, update:0, skip:0 });
      return NextResponse.json({
        success:true,preview,summary,
        requested:productIds.length,found:items.length,missing
      });
    }

    const result=await importItems(integration.id,'SHOPIFY',items,importSettings);
    const linked=await db.marketplaceProduct.count({where:{integrationId:integration.id,productId:{not:null}}});
    await db.marketplaceIntegration.update({
      where:{id:integration.id},
      data:{importedProducts:linked,lastSuccessAt:new Date(),lastError:null,healthStatus:'HEALTHY'}
    });
    const failed=missing+(result.failed||0);
    return NextResponse.json({
      success:true,requested:productIds.length,found:items.length,created:result.imported,
      updated:result.updated,skipped:result.skipped,failed
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Shopify import failed.'},{status:502});
  }
}