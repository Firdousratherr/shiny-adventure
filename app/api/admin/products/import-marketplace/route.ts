import {NextResponse} from 'next/server';
import {getAdminAccess} from '@/lib/admin-access';
import {db} from '@/lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';

type Marketplace='AMAZON'|'FLIPKART';

function parseMarketplaceUrl(sourceUrl:string):{provider:Marketplace;id:string;url:string}|null{
  let u:URL;
  try{u=new URL(sourceUrl)}catch{return null}
  const host=u.hostname.toLowerCase().replace(/^www\./,'');
  if(host==='amazon.in'||host==='amazon.com'||host==='amazon.co.uk'){
    const m=u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if(m)return {provider:'AMAZON',id:m[1].toUpperCase(),url:u.toString()};
  }
  if(host==='flipkart.com'){
    const pid=u.searchParams.get('pid');
    if(pid)return {provider:'FLIPKART',id:pid,url:u.toString()};
  }
  return null;
}

function slugify(v:string){return v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||'imported-product'}
function sellingPrice(cost:number,markup:number){return Math.round((cost*(1+markup/100))*100)/100}

export async function POST(req:Request){
  try{
    const access=await getAdminAccess();
    if(!access||(!access.isSuperAdmin&&(!access.permissions.includes('products')||!access.permissions.includes('marketplaces'))))return NextResponse.json({error:'Marketplace import permission required.'},{status:403});

    const body=await req.json();
    const action=body.action==='import'?'import':'preview';
    const sourceUrl=String(body.sourceUrl||'').trim();
    const name=String(body.name||'').trim();
    const description=String(body.description||'').trim();
    const markup=Number(body.markupPercent);
    const sourceCost=Number(body.sourceCost);

    if(!sourceUrl)return NextResponse.json({error:'Product URL is required.'},{status:400});
    if(!Number.isFinite(markup)||markup<0||markup>500)return NextResponse.json({error:'Markup must be between 0% and 500%.'},{status:400});
    if(!name)return NextResponse.json({error:'Product name is required. Copy the product title from Amazon or Flipkart.'},{status:400});
    if(!Number.isFinite(sourceCost)||sourceCost<=0)return NextResponse.json({error:'Enter the current source product price.'},{status:400});

    const parsed=parseMarketplaceUrl(sourceUrl);
    if(!parsed)return NextResponse.json({error:'Use a public Amazon.in/Amazon.com/Amazon.co.uk product URL or a Flipkart product URL containing its pid.'},{status:400});

    const imageUrls=Array.isArray(body.imageUrls)
      ? body.imageUrls.map((v:unknown)=>String(v).trim()).filter(Boolean).slice(0,8)
      : [];

    const product={
      provider:parsed.provider,
      externalId:parsed.id,
      title:name,
      description:description||undefined,
      sourceCost,
      images:imageUrls,
      sourceUrl:parsed.url,
    };
    const preview={...product,sellingPrice:sellingPrice(sourceCost,markup),markupPercent:markup};

    if(action==='preview')return NextResponse.json({product:preview});

    if(!access.isSuperAdmin&&!access.permissions.includes('pricing'))return NextResponse.json({error:'Pricing permission required to import products.'},{status:403});

    const provider=parsed.provider==='AMAZON'?'AMAZON_MANUAL':'FLIPKART_MANUAL';
    const integration=await db.marketplaceIntegration.upsert({
      where:{provider},
      update:{enabled:true,lastError:null},
      create:{provider,enabled:true},
    });

    const existing=await db.marketplaceProduct.findUnique({
      where:{integrationId_externalId:{integrationId:integration.id,externalId:product.externalId}},
      include:{product:true},
    });
    if(existing?.productId)return NextResponse.json({error:'This product is already imported into Zenvora.',productId:existing.productId},{status:409});

    let slug=slugify(product.title);
    let n=1;
    while(await db.product.findUnique({where:{slug}})){slug=slugify(product.title)+'-'+n++}

    const categoryName=product.title.split(/[-|:]/)[0].trim().slice(0,60)||'Imported';
    const category=await db.category.upsert({
      where:{slug:slugify(categoryName)},
      update:{},
      create:{name:categoryName,slug:slugify(categoryName)},
    });

    const created=await db.product.create({
      data:{
        name:product.title,
        slug,
        description:product.description||null,
        sourceUrl:product.sourceUrl,
        sourceCost:product.sourceCost,
        sellingPrice:preview.sellingPrice,
        stock:0,
        status:'DRAFT',
        categoryId:category.id,
      },
    });

    await db.marketplaceProduct.create({
      data:{
        integrationId:integration.id,
        externalId:product.externalId,
        productId:created.id,
        title:product.title,
        sourceUrl:product.sourceUrl,
        rawData:product,
      },
    });

    await db.marketplaceIntegration.update({
      where:{id:integration.id},
      data:{importedProducts:{increment:1},lastSuccessAt:new Date(),healthStatus:'HEALTHY'},
    });

    return NextResponse.json({
      productId:created.id,
      importedImages:0,
      message:'Product imported as DRAFT. Add permitted product images from the admin product editor.',
    });
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Marketplace import failed.'},{status:500});
  }
}