import { NextResponse } from 'next/server';
import { requireAdminPermission } from '../../../../lib/admin-access';
import { db } from '../../../../lib/db';
export async function GET(request: Request){
 const admin=await requireAdminPermission('customers'); if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});
 const url=new URL(request.url); const q=(url.searchParams.get('q')||'').trim();
 const customers=await db.customerUser.findMany({where:q?{OR:[{name:{contains:q,mode:'insensitive'}},{email:{contains:q,mode:'insensitive'}}]}:undefined,orderBy:{createdAt:'desc'},take:200});
 return NextResponse.json({customers});
}