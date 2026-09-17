import { redirect } from 'next/navigation';
import { auth } from '../../../auth';
import { db } from '../../../lib/db';
import RazorpayToggle from './razorpay-toggle';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect('/admin/login');
  const settings = await db.settings.findMany({ where: { key: { in: ['razorpayEnabled', 'razorpayKeyId'] } } });
  const values = Object.fromEntries(settings.map(s => [s.key, s.value]));
  return <main className="min-h-screen bg-slate-100"><div className="container py-8"><a href="/admin/dashboard" className="font-semibold">← Dashboard</a><h1 className="mt-6 text-3xl font-black">Payment settings</h1><section className="mt-8 max-w-2xl rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Razorpay</h2><p className="mt-2 text-sm text-slate-500">Enable direct online payments when your Razorpay account and server keys are configured.</p><RazorpayToggle enabled={values.razorpayEnabled === 'true'} keyId={values.razorpayKeyId || ''}/><p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"><b>Security:</b> never enter the Razorpay Key Secret here. Keep <code>RAZORPAY_KEY_SECRET</code> and <code>RAZORPAY_WEBHOOK_SECRET</code> only in Vercel/server environment variables.</p></section></div></main>;
}
