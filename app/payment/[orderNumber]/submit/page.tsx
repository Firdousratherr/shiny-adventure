'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SubmitPayment({
  params,
  searchParams,
}: {
  params: { orderNumber: string };
  searchParams: { token?: string };
}) {
  const [utr, setUtr] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const token = typeof searchParams.token === 'string' ? searchParams.token : '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!token) {
      setError('Invalid payment link. Please return to the payment page.');
      setLoading(false);
      return;
    }
    if (!/^\d{12}$/.test(utr)) {
      setError('UTR must be exactly 12 digits.');
      setLoading(false);
      return;
    }
    if (!file) {
      setError('Please upload your payment screenshot.');
      setLoading(false);
      return;
    }
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      setError('Upload an image up to 5 MB.');
      setLoading(false);
      return;
    }

    const fd = new FormData();
    fd.append('orderNumber', params.orderNumber);
    fd.append('paymentToken', token);
    fd.append('upiTransactionId', utr);
    fd.append('screenshot', file);

    try {
      const r = await fetch('/api/orders/payment', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Submission failed');
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <main className="container max-w-lg py-16 text-center">
        <h1 className="text-3xl font-black">Payment details submitted</h1>
        <p className="mt-4 text-slate-600">Your UTR and screenshot are awaiting manual verification. We will update your order after review.</p>
        <Link href={`/track?order=${encodeURIComponent(params.orderNumber)}`} className="mt-6 inline-block rounded-xl bg-slate-900 px-6 py-3 font-bold text-white">Track order</Link>
      </main>
    );
  }

  return (
    <main className="container max-w-lg py-10">
      <Link href={`/payment/${encodeURIComponent(params.orderNumber)}?token=${encodeURIComponent(token)}`} className="font-semibold">← Back to payment</Link>
      <form onSubmit={submit} className="mt-8 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <h1 className="text-2xl font-black">Submit payment details</h1>
        <label className="mt-6 block text-sm font-semibold">
          UTR / transaction reference
          <input value={utr} onChange={e => setUtr(e.target.value.replace(/\D/g, '').slice(0, 12))} inputMode="numeric" required className="mt-2 w-full rounded-xl border p-3" placeholder="12-digit UTR" />
        </label>
        <label className="mt-5 block text-sm font-semibold">
          Payment screenshot
          <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => setFile(e.target.files?.[0] || null)} className="mt-2 block w-full rounded-xl border p-3" />
          <span className="mt-1 block text-xs text-slate-500">JPG, PNG or WebP · maximum 5 MB</span>
        </label>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={loading} className="mt-6 w-full rounded-xl bg-slate-900 px-6 py-4 font-bold text-white disabled:opacity-50">{loading ? 'Submitting…' : 'Submit for verification'}</button>
      </form>
    </main>
  );
}
