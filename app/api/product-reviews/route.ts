import {NextResponse} from 'next/server';import {Prisma} from '@prisma/client';import {auth} from '../../../auth';import {db} from '../../../lib/db';import {z} from 'zod';
import { securityRateLimit } from '../../../lib/rate-limit';
const reviewQuerySchema=z.object({productId:z.string().trim().min(1).max(128)});
const reviewBodySchema=z.object({
  productId:z.string().trim().min(1).max(128),
  orderId:z.string().trim().max(128).optional(),
  rating:z.coerce.number().int().min(1).max(5),
  title:z.string().trim().max(160).optional().nullable(),
  body:z.string().trim().max(3000).optional().nullable(),
});
function publicName(name:string|null){const clean=(name||'Customer').trim();if(!clean)return 'Customer';const parts=clean.split(/\\s+/);if(parts.length===1)return parts[0].slice(0,1)+'***';return parts[0]+' '+parts[parts.length-1].slice(0,1)+'.';}
export async function GET(req:Request){
  const parsed=reviewQuerySchema.safeParse({productId:new URL(req.url).searchParams.get('productId')||''});
  if(!parsed.success)return NextResponse.json({error:'productId required'},{status:400});
  const reviews=await db.productReview.findMany({where:{productId:parsed.data.productId,status:'APPROVED'},orderBy:{createdAt:'desc'},take:50,select:{id:true,rating:true,title:true,body:true,customerName:true,verified:true,createdAt:true}});
  return NextResponse.json({reviews:reviews.map(r=>({...r,customerName:publicName(r.customerName)}))});
}
export async function POST(req:Request){
  const s=await auth();
  if(s?.user?.role!=='customer'||!s.user.email)return NextResponse.json({error:'Customer login required.'},{status:401});

  const limited=await securityRateLimit('review:'+s.user.email.toLowerCase(),10,600);
  if(limited.securityUnavailable)return NextResponse.json({error:'This security service is temporarily unavailable.'},{status:503});if(limited.limited)return NextResponse.json({error:'Too many review submissions. Please try again later.'},{status:429,headers:{'Retry-After':'600'}});

  const b=await req.json().catch(()=>null);
  const parsed=reviewBodySchema.safeParse(b);
  if(!parsed.success)return NextResponse.json({error:'Valid product, rating and review content are required.'},{status:400});
  const {productId,orderId:requestedOrderId,rating,title,body}=parsed.data;

  const customer=await db.customerUser.findUnique({where:{email:s.user.email},select:{id:true,name:true,email:true}});
  if(!customer)return NextResponse.json({error:'Customer not found.'},{status:404});

  const product=await db.product.findFirst({where:{id:productId,status:'ACTIVE'},select:{id:true}});
  if(!product)return NextResponse.json({error:'Product not found.'},{status:404});

  let verified=false;
  let orderId:string|null=null;
  if(requestedOrderId){
    const order=await db.order.findFirst({
      where:{
        id:requestedOrderId,
        email:customer.email,
        deletedAt:null,
        status:'DELIVERED',
        items:{some:{productId}},
      },
      select:{id:true},
    });
    if(!order)return NextResponse.json({error:'That order does not belong to you or does not contain this product.'},{status:403});
    orderId=order.id;
    verified=true;
  }

  const existing=await db.productReview.findFirst({
    where:{productId,customerId:customer.id},
    select:{id:true},
  });
  if(existing)return NextResponse.json({error:'You have already submitted a review for this product.'},{status:409});

  try {
    const review=await db.productReview.create({
      data:{
        productId,
        customerId:customer.id,
        customerName:customer.name,
        customerEmail:customer.email,
        orderId,
        rating,
        title:title||null,
        body:body||null,
        verified,
      },
    });
    return NextResponse.json({review},{status:201});
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({error:'You have already submitted a review for this product.'},{status:409});
    }
    throw error;
  }
}