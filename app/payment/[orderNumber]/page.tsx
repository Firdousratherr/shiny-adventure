import { notFound } from 'next/navigation';

export const dynamic='force-dynamic';
export const revalidate=0;

import Link from 'next/link';
import QRCode from 'qrcode';
import { db } from '../../../lib/db';
import RazorpayButton from '../../../components/razorpay-button';
import { verifyPaymentAccessToken } from '../../../lib/payment-access';
import { releaseExpiredPaymentReservations } from '../../../lib/inventory-reservations';

export default async function PaymentPage({params,searchParams}:{params:{orderNumber:string};searchParams:{token?:string}}){
  await db.$transaction(async tx=>{await releaseExpiredPaymentReservations(tx);});
  const orderNumber=params.orderNumber.trim().toUpperCase();
  const token=typeof searchParams.token==='string'?searchParams.token:'';
  const order=await db.order.findUnique({where:{orderNumber},select:{orderNumber:true,totalAmount:true,status:true,reservationExpiresAt:true,cancellationReason:true,paymentAccessTokenHash:true}});
  if(!order||!verifyPaymentAccessToken(token,order.paymentAccessTokenHash))notFound();

  const settings=await db.settings.findMany({where:{key:{in:['upiId','upiDisplayName','razorpayEnabled','razorpayKeyId']}}});
  const s=Object.fromEntries(settings.map(x=>[x.key,x.value]));
  const upiId=s.upiId||'';
  const razorpayKeyId=process.env.RAZORPAY_KEY_ID||s.razorpayKeyId||'';
  const razorpayEnabled=s.razorpayEnabled==='true'&&!!razorpayKeyId;
  const intent=upiId?'upi://pay?pa='+encodeURIComponent(upiId)+'&am='+encodeURIComponent(order.totalAmount.toFixed(2))+'&cu=INR':'';
  const qr=upiId?await QRCode.toDataURL(intent,{width:320,margin:2}):'';
  const reservationExpiresAt=order.reservationExpiresAt;
  const expiresAt=reservationExpiresAt?reservationExpiresAt.getTime():0;
  const paymentWindowExpired=(order.status==='PAYMENT_PENDING'&&(!expiresAt||expiresAt<=Date.now()))||order.cancellationReason==='Payment reservation expired.';

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-3 py-8 text-slate-900 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="brand-mark text-2xl font-black">Zenvora<span className="text-fuchsia-500">.</span></Link>
        <div className="mt-6 overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl shadow-violet-950/10">
          <div className="bg-gradient-to-r from-[#171047] via-[#4b2ab7] to-[#8b3fe5] px-5 py-7 text-white sm:px-8">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-violet-200">Secure payment</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">Complete your order</h1>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs text-violet-100/70">Order number</p><p className="mt-1 font-black">{order.orderNumber}</p></div><div className="text-right"><p className="text-xs text-violet-100/70">Amount</p><p className="mt-1 text-3xl font-black">₹{Number(order.totalAmount).toLocaleString('en-IN',{minimumFractionDigits:2})}</p></div></div>
          </div>

          <div className="p-5 sm:p-8">
            {paymentWindowExpired ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">This payment session has expired and the inventory reservation was released. Please place a new order.</p> :
            order.status!=='PAYMENT_PENDING' ? <p className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-bold text-violet-800">This order is already under payment review or has progressed.</p> :
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Step 1</p><p className="mt-1 font-black">Choose payment</p><p className="mt-1 text-xs leading-5 text-slate-500">Use online payment or your UPI app.</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-400">Step 2</p><p className="mt-1 font-black">Submit proof</p><p className="mt-1 text-xs leading-5 text-slate-500">For UPI, keep the UTR ready for verification.</p></div>
              </div>

              {reservationExpiresAt&&<p className="mt-5 text-xs text-slate-500">Inventory reserved until {reservationExpiresAt.toLocaleString('en-IN')}.</p>}
              {razorpayEnabled&&<div className="mt-5"><RazorpayButton orderNumber={order.orderNumber} paymentToken={token} keyId={razorpayKeyId}/></div>}

              {upiId&&<>
                <div className="my-7 flex items-center gap-3 text-xs font-black text-slate-400"><span className="h-px flex-1 bg-slate-200"/><span>OR PAY BY UPI</span><span className="h-px flex-1 bg-slate-200"/></div>
                <div className="rounded-[26px] border border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-5 text-center">
                  <p className="font-black">Pay using any UPI app</p>
                  {qr&&<img src={qr} alt="UPI payment QR code" className="mx-auto mt-5 h-64 w-64 rounded-2xl border border-white bg-white p-2 shadow-md"/>}
                  <p className="mt-4 text-sm text-slate-500">UPI ID: <strong className="text-slate-800">{upiId}</strong>{s.upiDisplayName&&<> · {s.upiDisplayName}</>}</p>
                  <a href={intent} className="mt-5 inline-flex rounded-full bg-gradient-to-r from-violet-700 to-fuchsia-500 px-6 py-3 font-black text-white shadow-lg shadow-violet-500/20">Pay with UPI app →</a>
                </div>
                <div className="mt-6 rounded-2xl border border-slate-200 p-5">
                  <h2 className="font-black">After payment</h2>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600"><li>Complete the payment for the exact amount shown above.</li><li>Keep your UTR / transaction reference number.</li><li>Submit your UTR and payment screenshot to Zenvora for manual verification.</li></ol>
                  <Link href={'/payment/'+encodeURIComponent(order.orderNumber)+'/submit?token='+encodeURIComponent(token)} className="mt-5 block rounded-xl border border-violet-200 bg-violet-50 px-6 py-3 text-center font-black text-violet-800 hover:bg-violet-100">Submit payment details →</Link>
                </div>
              </>}

              {!razorpayEnabled&&!upiId&&<p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">No payment method is configured yet. Please contact support.</p>}
            </>}
          </div>
        </div>
      </div>
    </main>
  );
}
