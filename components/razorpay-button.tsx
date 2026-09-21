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
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
};

export default function RazorpayButton({ orderNumber, paymentToken, keyId, prefill }: Props) {
  const [busy, setBusy] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function pay() {
    if (busy) return;
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

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Unable to start Razorpay payment.');

      const checkout = new window.Razorpay({
        key: keyId,
        amount: Number(data.amount),
        currency: data.currency || 'INR',
        order_id: data.razorpayOrderId,
        name: 'Zenvora',
        description: `Payment for ${orderNumber}`,
        prefill: {
          name: prefill?.name || undefined,
          email: prefill?.email || undefined,
          contact: prefill?.contact || undefined,
        },
        notes: {
          zenvora_order_number: orderNumber,
        },
        theme: { color: '#4f46e5' },
        modal: {
          ondismiss: () => setBusy(false),
          confirm_close: true,
        },
      });

      checkout.on('payment.failed', (response: any) => {
        const err = response?.error || {};
        const description = err.description || err.reason || 'Razorpay payment failed.';
        const code = err.code ? ` (${err.code})` : '';
        setError(`${description}${code} Please try another payment method or retry.`);
        setBusy(false);
      });

      checkout.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start Razorpay payment.');
      setBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => {
          setScriptReady(false);
          setError('Unable to load Razorpay Checkout. Please disable blockers or refresh the page.');
        }}
      />

      <button
        type="button"
        disabled={busy || !scriptReady}
        onClick={pay}
        className="w-full rounded-xl bg-blue-600 px-6 py-4 font-bold text-white disabled:opacity-50"
      >
        {busy ? 'Processing…' : !scriptReady ? 'Loading secure payment…' : 'Pay securely with Razorpay'}
      </button>

      <div className="mt-3 rounded-xl border border-blue-200/20 bg-blue-500/10 p-3 text-left text-xs text-slate-300">
        <p className="font-bold text-blue-200">Razorpay Test Mode</p>
        <p className="mt-1">
          If your Razorpay account is in Test Mode, do not scan the checkout QR with a real UPI app.
          In the Razorpay UPI test flow, enter <strong className="text-white">success@razorpay</strong> to simulate a successful payment.
          Use <strong className="text-white">failure@razorpay</strong> to test a failed payment.
        </p>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-left text-sm font-semibold text-red-700">
          <p>{error}</p>
          <p className="mt-1 text-xs font-medium text-red-600">
            If money was debited, do not pay again immediately; check your bank/Razorpay transaction status first.
          </p>
        </div>
      )}
    </div>
  );
}
