import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { credentialStatus, marketplaceCredentials, importItems, type SyncItem } from '../../../../../lib/marketplaces';
import { getShopifyAccessToken } from '../../../../../lib/shopify';

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
      if(!r.ok||j.errors?.length)throw new Error(j.errors?.map((e:any)=>e.message).join('; ')||'Shopify request failed');
    }finally{clearTimeout(timer);}

    const items:SyncItem[]=(j.data?.nodes||[]).filter(Boolean).map((x:any)=>({
      externalId:x.id,title:x.title,sourceUrl:x.onlineStoreUrl||null,
      sourceCost:Number(x.variants?.nodes?.[0]?.price||0)||null,
      imageUrl:x.images?.nodes?.[0]?.url||null,rawData:x
    }));
    const missing=productIds.length-items.length;
    const result=await importItems(integration.id,'SHOPIFY',items,{
      markupPercent:markup,fixedAmount:fixed,maxItemsPerSync:items.length,
      automatic:false,changedBy:admin.email||'ADMIN',
      skipExisting:Boolean(body.skipExisting),skipOutOfStock:Boolean(body.skipOutOfStock),
      skipWithoutImages:Boolean(body.skipWithoutImages),skipWithoutPrice:Boolean(body.skipWithoutPrice)
    });
    const linked=await db.marketplaceProduct.count({where:{integrationId:integration.id,productId:{not:null}}});
    await db.marketplaceIntegration.update({
      where:{id:integration.id},
      data:{importedProducts:linked,lastSuccessAt:new Date(),lastError:null,healthStatus:'HEALTHY'}
    });
    const failed=missing+Math.max(0,items.length-result.imported-result.updated-result.skipped);
    return NextResponse.json({
      success:true,requested:productIds.length,found:items.length,created:result.imported,
      updated:result.updated,skipped:result.skipped,failed
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Shopify import failed.'},{status:502});
  }
}