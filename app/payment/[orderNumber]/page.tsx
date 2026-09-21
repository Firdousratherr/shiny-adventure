import { notFound } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import { db } from '../../../lib/db';
import RazorpayButton from '../../../components/razorpay-button';
import { verifyPaymentAccessToken } from '../../../lib/payment-access';
import { releaseExpiredPaymentReservations } from '../../../lib/inventory-reservations';

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: { orderNumber: string };
  searchParams: { token?: string };
}) {
  await db.$transaction(async tx => { await releaseExpiredPaymentReservations(tx); });

  const orderNumber = params.orderNumber.trim().toUpperCase();
  const token = typeof searchParams.token === 'string' ? searchParams.token : '';
  const order = await db.order.findUnique({
    where: { orderNumber },
    select: { orderNumber: true, totalAmount: true, status: true, reservationExpiresAt: true, cancellationReason: true, paymentAccessTokenHash: true },
  });
  if (!order || !verifyPaymentAccessToken(token, order.paymentAccessTokenHash)) notFound();

  const settings = await db.settings.findMany({ where: { key: { in: ['upiId', 'upiDisplayName', 'razorpayEnabled', 'razorpayKeyId'] } } });
  const s = Object.fromEntries(settings.map(x => [x.key, x.value]));
  const upiId = s.upiId || '';
  // Keep the browser key paired with the server secret. Vercel's environment
  // variable is canonical; the database value is only a fallback for older setups.
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || s.razorpayKeyId || '';
  const razorpayEnabled = s.razorpayEnabled === 'true' && !!razorpayKeyId;
  const intent = upiId ? `upi://pay?pa=${encodeURIComponent(upiId)}&am=${encodeURIComponent(order.totalAmount.toFixed(2))}&cu=INR` : '';
  const qr = upiId ? await QRCode.toDataURL(intent, { width: 320, margin: 2 }) : '';
  const reservationExpiresAt = order.reservationExpiresAt;
  const expiresAt = reservationExpiresAt ? reservationExpiresAt.getTime() : 0;
  const paymentWindowExpired = (order.status === 'PAYMENT_PENDING' && (!expiresAt || expiresAt <= Date.now())) || order.cancellationReason === 'Payment reservation expired.';

  return (
    <main className="min-h-screen bg-[#070b16] px-0 py-8 text-white sm:py-12">
      <Link href="/" className="text-2xl font-black">Zenvora</Link>
      <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 text-center shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-sm font-semibold text-slate-400">Order created</p>
        <h1 className="mt-2 text-3xl font-black">{order.orderNumber}</h1>
        <p className="mt-4 text-3xl font-black">₹{Number(order.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        {paymentWindowExpired ? (
          <p className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 font-semibold text-amber-200">This payment session has expired and the inventory reservation was released. Please place a new order.</p>
        ) : order.status !== 'PAYMENT_PENDING' ? (
          <p className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4 font-semibold text-slate-200">This order is already under payment review or has progressed.</p>
        ) : (
          <>
            <p className="mt-6 font-semibold">Choose your payment method</p>
            {reservationExpiresAt && (
              <p className="mt-2 text-xs text-slate-500">Inventory reserved until {reservationExpiresAt.toLocaleString('en-IN')}.</p>
            )}
            {razorpayEnabled && <RazorpayButton orderNumber={order.orderNumber} paymentToken={token} keyId={razorpayKeyId} />}
            {upiId && (
              <>
                <div className="my-7 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200"/><span>OR PAY BY UPI</span><span className="h-px flex-1 bg-slate-200"/></div>
                <p className="font-semibold">Pay using any UPI app</p>
                {qr && <img src={qr} alt="UPI payment QR code" className="mx-auto mt-4 h-64 w-64" />}
                <p className="mt-3 text-sm text-slate-500">UPI ID: <strong>{upiId}</strong>{s.upiDisplayName && <> · {s.upiDisplayName}</>}</p>
                <a href={intent} className="mt-5 inline-block rounded-xl bg-white px-6 py-3 font-black text-slate-950">Pay with UPI app</a>
                <div className="mt-8 border-t border-white/10 pt-6 text-left">
                  <h2 className="font-bold">After payment</h2>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-300">
                    <li>Complete the payment for the exact amount shown above.</li>
                    <li>Keep your UTR / transaction reference number.</li>
                    <li>Submit your UTR and payment screenshot to Zenvora for manual verification.</li>
                  </ol>
                  <Link href={`/payment/${encodeURIComponent(order.orderNumber)}/submit?token=${encodeURIComponent(token)}`} className="mt-5 block rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-center font-bold hover:bg-white/10">Submit payment details</Link>
                </div>
              </>
            )}
            {!razorpayEnabled && !upiId && <p className="mt-6 rounded-xl bg-amber-50 p-4 text-amber-800">No payment method is configured yet. Please contact support.</p>}
          </>
        )}
      </div>
    </main>
  );
}
