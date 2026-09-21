'use client';

import { useState } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type Props = {
  orderNumber: string;
  paymentToken: string;
  keyId: string;
};

export default function RazorpayButton({ orderNumber, paymentToken, keyId }: Props) {
  const [busy, setBusy] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function pay() {
    setBusy(true);
    setError('');

    try {
      if (!scriptReady || !window.Razorpay) {
        throw new Error('Razorpay checkout is still loading. Please wait a moment and try again.');
      }

      const r = await fetch('/api/orders/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, paymentToken }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Unable to start Razorpay payment.');

      const checkout = new window.Razorpay({
        key: keyId,
        amount: data.amount,
        currency: data.currency || 'INR',
        order_id: data.razorpayOrderId,
        name: 'Zenvora',
        description: `Payment for ${orderNumber}`,
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
        },
        theme: {
          color: '#4f46e5',
        },
        handler: async (response: {
          razorpay_payment_id?: string;
          razorpay_order_id?: string;
          razorpay_signature?: string;
        }) => {
          try {
            const vr = await fetch('/api/orders/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...response, orderNumber, paymentToken }),
            });

            const vd = await vr.json();
            if (!vr.ok) throw new Error(vd.error || 'Payment verification failed.');

            router.push(`/track?order=${encodeURIComponent(orderNumber)}`);
          } catch (verificationError) {
            setError(
              verificationError instanceof Error
                ? verificationError.message
                : 'Payment was received but verification could not be completed. Please contact support.',
            );
          }
        },
      });

      checkout.on('payment.failed', (response: any) => {
        const description = response?.error?.description;
        const reason = response?.error?.reason;
        setError(
          description ||
            (reason
              ? `Razorpay payment failed: ${reason}`
              : 'Razorpay payment failed. Please try another payment method.'),
        );
      });

      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start Razorpay payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => setError('Unable to load Razorpay checkout. Please refresh and try again.')}
      />

      <button
        type="button"
        disabled={busy || !scriptReady}
        onClick={pay}
        className="w-full rounded-xl bg-blue-600 px-6 py-4 font-bold text-white disabled:opacity-50"
      >
        {busy ? 'Starting Razorpay…' : !scriptReady ? 'Loading secure payment…' : 'Pay securely with Razorpay'}
      </button>

      {error && (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
