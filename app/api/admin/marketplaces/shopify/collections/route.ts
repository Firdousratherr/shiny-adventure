import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { requireAdminPermission } from '../../../../../lib/admin-access';
import { credentialStatus, marketplaceCredentials } from '../../../../../lib/marketplaces';
import { getShopifyAccessToken } from '../../../../../lib/shopify';

export async function GET() {
 const admin=await requireAdminPermission('marketplaces'); if(!admin)return NextResponse.json({error:'Marketplace permission required.'},{status:403});
 try { if(!(await credentialStatus('SHOPIFY')))return NextResponse.json({error:'Shopify is not configured.'},{status:409}); const {domain,accessToken}=await getShopifyAccessToken(await marketplaceCredentials('SHOPIFY')); const query='query { collections(first: 250, sortKey: TITLE) { nodes { id title handle productsCount { count } } } }'; const r=await fetch('https://'+domain+'/admin/api/2026-07/graphql.json',{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':accessToken},body:JSON.stringify({query}),cache:'no-store'}); const j:any=await r.json(); if(!r.ok||j.errors?.length)throw new Error(j.errors?.map((e:any)=>e.message).join('; ')||'Shopify request failed'); return NextResponse.json({collections:(j.data?.collections?.nodes||[]).map((x:any)=>({id:x.id,title:x.title,handle:x.handle,productsCount:Number(x.productsCount?.count||0)}))}); } catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to load Shopify collections.'},{status:502});}
}
