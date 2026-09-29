import {NextResponse} from 'next/server';import {auth} from '../../../auth';import {db} from '../../../lib/db';
export async function GET(req:Request){const id=new URL(req.url).searchParams.get('productId')||'';if(!id)return NextResponse.json({error:'productId required'},{status:400});const reviews=await db.productReview.findMany({where:{productId:id,status:'APPROVED'},orderBy:{createdAt:'desc'},take:50,select:{id:true,rating:true,title:true,body:true,customerName:true,verified:true,createdAt:true}});return NextResponse.json({reviews})}
export async function POST(req:Request){
  const s=await auth();
  if(s?.user?.role!=='customer'||!s.user.email)return NextResponse.json({error:'Customer login required.'},{status:401});

  const b=await req.json().catch(()=>({}));
  const productId=typeof b.productId==='string'?b.productId.trim():'';
  const requestedOrderId=typeof b.orderId==='string'?b.orderId.trim():'';
  const rating=Number(b.rating);
  if(!productId||rating<1||rating>5||!Number.isInteger(rating))return NextResponse.json({error:'Valid product and rating are required.'},{status:400});

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
        items:{some:{productId}},
      },
      select:{id:true},
    });
    if(!order)return NextResponse.json({error:'That order does not belong to you or does not contain this product.'},{status:403});
    orderId=order.id;
    verified=true;
  }

  const existing=await db.productReview.findFirst({
    where:{productId,customerId:customer.id,...(orderId?{orderId}:{})},
    select:{id:true},
  });
  if(existing)return NextResponse.json({error:'You have already submitted a review for this product.'},{status:409});

  const review=await db.productReview.create({
    data:{
      productId,
      customerId:customer.id,
      customerName:customer.name,
      customerEmail:customer.email,
      orderId,
      rating,
      title:typeof b.title==='string'?b.title.trim().slice(0,160):null,
      body:typeof b.body==='string'?b.body.trim().slice(0,3000):null,
      verified,
    },
  });
  return NextResponse.json({review},{status:201});
}