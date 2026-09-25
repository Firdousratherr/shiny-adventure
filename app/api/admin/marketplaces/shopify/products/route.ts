import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../../../lib/admin-access';
import { credentialStatus, marketplaceCredentials } from '../../../../../../lib/marketplaces';
import { getShopifyAccessToken } from '../../../../../../lib/shopify';
import { db } from '../../../../../../lib/db';
function graphQLErrorMessage(errors: unknown) {
  if (Array.isArray(errors)) return errors.map((e: any) => String(e?.message || e)).join('; ');
  if (errors && typeof errors === 'object') return Object.values(errors as Record<string, unknown>).map((e: any) => String(e?.message || e)).join('; ');
  return '';
}

const Q='query Products($first:Int!, $after:String, $query:String) { products(first:$first, after:$after, query:$query, sortKey:TITLE) { pageInfo { hasNextPage endCursor } nodes { id title vendor productType descriptionHtml onlineStoreUrl totalInventory images(first:20) { nodes { url } } variants(first:100) { nodes { id title sku barcode price compareAtPrice inventoryQuantity } } collections(first:10) { nodes { id title handle } } } } }';
async function shopifyQuery(domain:string,token:string,variables:any){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch('https://'+domain+'/admin/api/2026-07/graphql.json',{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':token},body:JSON.stringify({query:Q,variables}),cache:'no-store',signal:controller.signal});
    const raw=await r.text();
    let j:any={};
    try{j=raw?JSON.parse(raw):{};}catch{throw new Error('Shopify returned a non-JSON response (HTTP '+r.status+').');}
    if(j.errors){
      const detail=graphQLErrorMessage(j.errors)||JSON.stringify(j.errors);
      throw new Error('Shopify GraphQL error: '+detail);
    }
    if(!r.ok){
      const reason=typeof j?.error==='string'?j.error:typeof j?.message==='string'?j.message:'';
      throw new Error('Shopify Admin API returned HTTP '+r.status+(reason?': '+reason:''));
    }
    if(!j.data?.products) throw new Error('Shopify returned no products data. Response: '+JSON.stringify(j).slice(0,500));
    return j.data.products;
  }catch(error){
    if(error instanceof Error && error.name==='AbortError') throw new Error('Shopify product request timed out after 20 seconds.');
    throw error;
  }finally{clearTimeout(timer);}
}
function mapProduct(x:any,imported:Set<string>){return{id:x.id,title:x.title,imageUrl:x.images?.nodes?.[0]?.url||null,price:Number(x.variants?.nodes?.[0]?.price||0),inventory:Number(x.totalInventory||0),url:x.onlineStoreUrl||null,productType:x.productType||'',vendor:x.vendor||'',collections:(x.collections?.nodes||[]).map((c:any)=>c.title),imported:imported.has(x.id)}}
export async function GET(request:Request){const admin=await requireAdminPermission('marketplaces');if(!admin)return NextResponse.json({error:'Marketplace permission required.'},{status:403});try{if(!(await credentialStatus('SHOPIFY')))return NextResponse.json({error:'Shopify is not configured.'},{status:409});const {domain,accessToken}=await getShopifyAccessToken(await marketplaceCredentials('SHOPIFY'));const url=new URL(request.url);const scope=url.searchParams.get('scope')||'selected';const search=url.searchParams.get('search')?.trim()||'';const collectionIds=url.searchParams.getAll('collectionId');const importedRows=await db.marketplaceProduct.findMany({where:{integration:{provider:'SHOPIFY'}},select:{externalId:true}});const imported=new Set(importedRows.map(x=>x.externalId));const output:any[]=[];const seen=new Set<string>();const baseQueries=scope==='collections'&&collectionIds.length?collectionIds.map(id=>'collection_id:'+id.split('/').pop()):[''];const queries=baseQueries.map(q=>search?(q?`${q} AND `:'')+search:q);for(const q of queries){let after:string|null=null;do{const page=await shopifyQuery(domain,accessToken,{first:250,after,query:q||null});for(const x of page.nodes||[])if(!seen.has(x.id)){seen.add(x.id);output.push(mapProduct(x,imported));}after=page.pageInfo?.hasNextPage?page.pageInfo.endCursor:null;}while(after&&output.length<10000);}return NextResponse.json({products:output,total:output.length,scope,hasMore:output.length>=10000});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to load Shopify products.'},{status:502});}}
