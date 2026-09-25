import { NextResponse } from 'next/server';
import { db } from '../../../../../../lib/db';
import { requireAdminPermission } from '../../../../../../lib/admin-access';
import { credentialStatus, marketplaceCredentials } from '../../../../../../lib/marketplaces';
import { shopifyGraphQL } from '../../../../../../lib/shopify';

export async function GET() {
 const admin=await requireAdminPermission('marketplaces'); if(!admin)return NextResponse.json({error:'Marketplace permission required.'},{status:403});
 try {
   if(!(await credentialStatus('SHOPIFY')))return NextResponse.json({error:'Shopify is not configured.'},{status:409});
   const credentials=await marketplaceCredentials('SHOPIFY');
   const query='query { collections(first: 250, sortKey: TITLE) { nodes { id title handle productsCount { count } } } }';
   const { data } = await shopifyGraphQL<{ collections?: { nodes?: any[] } }>(credentials,query);
   return NextResponse.json({collections:(data.collections?.nodes||[]).map((x:any)=>({id:x.id,title:x.title,handle:x.handle,productsCount:Number(x.productsCount?.count||0)}))});
 } catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to load Shopify collections.'},{status:502});}
}
