import {NextResponse} from 'next/server';
import {getAdminAccess} from '@/lib/admin-access';
import {db} from '@/lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Marketplace='AMAZON'|'FLIPKART';

function parseMarketplaceUrl(sourceUrl:string):{provider:Marketplace; id:string; url:string}|null{
  let u:URL;
  try{u=new URL(sourceUrl)}catch{return null}
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  if(host==='amazon.in'||host==='amazon.com'||host==='amazon.co.uk'){
    const m=u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if(m)return {provider:'AMAZON',id:m[1].toUpperCase(),url:u.toString()};
  }
  if(host==='flipkart.com'){
    const m=u.pathname.match(/\/p\/([a-z0-9]+)/i);
    if(m)return {provider:'FLIPKART',id:m[1],url:u.toString()};
  }
  return null;
}

async function amazonToken(){
  const clientId=process.env.AMAZON_CREATORS_CLIENT_ID;
  const clientSecret=process.env.AMAZON_CREATORS_CLIENT_SECRET;
  if(!clientId||!clientSecret)throw new Error('Amazon Creators API is not configured. Add AMAZON_CREATORS_CLIENT_ID and AMAZON_CREATORS_CLIENT_SECRET.');
  const tokenUrl=process.env.AMAZON_CREATORS_TOKEN_URL||'https://api.amazon.co.uk/auth/o2/token';
  const r=await fetch(tokenUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret,scope:'creatorsapi::default'}),cache:'no-store'});
  if(!r.ok)throw new Error('Amazon authentication failed. Check your Creators API credentials.');
  const j=await r.json(); if(!j.access_token)throw new Error('Amazon did not return an access token.'); return j.access_token as string;
}

async function fetchAmazon(asin:string,sourceUrl:string){
  const token=await amazonToken();
  const marketplace=process.env.AMAZON_CREATORS_MARKETPLACE||'www.amazon.in';
  const partnerTag=process.env.AMAZON_ASSOCIATES_PARTNER_TAG;
  if(!partnerTag)throw new Error('Amazon Partner Tag is not configured. Add AMAZON_ASSOCIATES_PARTNER_TAG.');
  const r=await fetch('https://creatorsapi.amazon/catalog/v1/getItems',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','x-marketplace':marketplace},body:JSON.stringify({itemIds:[asin],itemIdType:'ASIN',marketplace,partnerTag,resources:['images.primary.large','images.variants.large','itemInfo.title','itemInfo.features','itemInfo.productInfo','offersV2.listings.price','offersV2.listings.availability','browseNodeInfo.browseNodes'] }),cache:'no-store'});
  if(!r.ok){const t=await r.text(); throw new Error(t.includes('AccessDenied')?'Amazon denied this API request. Verify Creators API access and Partner Tag.':'Amazon product lookup failed.');}
  const j=await r.json(); const item=j.itemsResult?.items?.[0];
  if(!item)throw new Error('Amazon product was not found.');
  const name=item.itemInfo?.title?.displayValue||item.itemInfo?.title?.value;
  const price=item.offersV2?.listings?.[0]?.price?.money?.amount??item.offers?.listings?.[0]?.price?.amount;
  const images=[item.images?.primary?.large?.url,...(item.images?.variants||[]).map((x:any)=>x?.large?.url)].filter(Boolean).slice(0,8);
  if(!name||price==null)throw new Error('Amazon returned incomplete product data (title or price missing).');
  return {provider:'AMAZON' as const,externalId:asin,title:String(name),description:Array.isArray(item.itemInfo?.features?.displayValues)?item.itemInfo.features.displayValues.join('\n'):undefined,sourceCost:Number(price),images,sourceUrl};
}

async function fetchFlipkart(productId:string,sourceUrl:string){
  const affiliateId=process.env.FLIPKART_AFFILIATE_ID;
  const token=process.env.FLIPKART_AFFILIATE_TOKEN;
  if(!affiliateId||!token)throw new Error('Flipkart Affiliate API is not configured. Add FLIPKART_AFFILIATE_ID and FLIPKART_AFFILIATE_TOKEN.');
  const api='https://affiliate-api.flipkart.net/affiliate/1.0/product.json?id='+encodeURIComponent(productId);
  const r=await fetch(api,{headers:{'Fk-Affiliate-Id':affiliateId,'Fk-Affiliate-Token':token},cache:'no-store'});
  if(!r.ok)throw new Error(r.status===401?'Flipkart authentication failed. Check Affiliate ID and API Token.':'Flipkart product lookup failed.');
  const j=await r.json();
  const p=j.productInfoList?.[0]??j.productInfo?.[0]??j.products?.[0]??j.productBaseInfoV1;
  const base=p?.productBaseInfoV1||p?.productBaseInfo||p;
  const title=base?.title;
  const price=base?.price?.sellingPrice??base?.price?.finalPrice??base?.sellingPrice??base?.flipkartSellingPrice??base?.flipkartSpecialPrice;
  const imageSource=base?.imageUrls; const imageValues=imageSource&&typeof imageSource==='object'&&!Array.isArray(imageSource)?Object.values(imageSource):Array.isArray(imageSource)?imageSource:[]; const images=[...imageValues,base?.imageUrl].map((x:any)=>typeof x==='string'?x:x?.url).filter(Boolean).slice(0,8);
  if(!title||price==null)throw new Error('Flipkart returned incomplete product data. Try another product URL.');
  return {provider:'FLIPKART' as const,externalId:productId,title:String(title),description:base?.description?String(base.description):undefined,sourceCost:Number(price),images,sourceUrl};
}

function slugify(v:string){return v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'imported-product'}
function sellingPrice(cost:number,markup:number){return Math.round((cost*(1+markup/100))*100)/100}

export async function POST(req:Request){
  try{
    const access=await getAdminAccess();
    if(!access||(!access.isSuperAdmin&&(!access.permissions.includes('products')||!access.permissions.includes('marketplaces'))))return NextResponse.json({error:'Marketplace import permission required.'},{status:403});
    const body=await req.json(); const action=body.action==='import'?'import':'preview'; const sourceUrl=String(body.sourceUrl||'').trim(); const markup=Number(body.markupPercent);
    if(!sourceUrl)return NextResponse.json({error:'Product URL is required.'},{status:400});
    if(!Number.isFinite(markup)||markup<0||markup>500)return NextResponse.json({error:'Markup must be between 0% and 500%.'},{status:400});
    const parsed=parseMarketplaceUrl(sourceUrl); if(!parsed)return NextResponse.json({error:'Use a public Amazon.in/Amazon.com/Amazon.co.uk product URL or a Flipkart product URL.'},{status:400});
    const product=parsed.provider==='AMAZON'?await fetchAmazon(parsed.id,parsed.url):await fetchFlipkart(parsed.id,parsed.url);
    const preview={...product,sellingPrice:sellingPrice(product.sourceCost,markup),markupPercent:markup};
    if(action==='preview')return NextResponse.json({product:preview});
    if(!access.isSuperAdmin&&!access.permissions.includes('pricing'))return NextResponse.json({error:'Pricing permission required to import products.'},{status:403});
    const provider=parsed.provider==='AMAZON'?'AMAZON_CREATORS_API':'FLIPKART_AFFILIATE_API';
    const integration=await db.marketplaceIntegration.upsert({where:{provider},update:{enabled:true,lastError:null},create:{provider,enabled:true}});
    const existing=await db.marketplaceProduct.findUnique({where:{integrationId_externalId:{integrationId:integration.id,externalId:product.externalId}},include:{product:true}});
    if(existing?.productId)return NextResponse.json({error:'This product is already imported into Zenvora.',productId:existing.productId},{status:409});
    let slug=slugify(product.title); let n=1; while(await db.product.findUnique({where:{slug}})){slug=slugify(product.title)+'-'+n++}
    const categoryName=product.title.split(/[-|:]/)[0].trim().slice(0,60)||'Imported';
    const category=await db.category.upsert({where:{slug:slugify(categoryName)},update:{},create:{name:categoryName,slug:slugify(categoryName)}});
    const created=await db.product.create({data:{name:product.title,slug,description:product.description||null,sourceUrl:product.sourceUrl,sourceCost:product.sourceCost,sellingPrice:preview.sellingPrice,stock:0,status:'DRAFT',categoryId:category.id}});
    await db.marketplaceProduct.create({data:{integrationId:integration.id,externalId:product.externalId,productId:created.id,title:product.title,sourceUrl:product.sourceUrl,rawData:product}});
    await db.marketplaceIntegration.update({where:{id:integration.id},data:{importedProducts:{increment:1},lastSuccessAt:new Date(),healthStatus:'HEALTHY'}});
    return NextResponse.json({productId:created.id,importedImages:0,message:'Product imported as DRAFT. Add images manually if needed.'});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Marketplace import failed.'},{status:500})}
}