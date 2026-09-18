'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const r = await signIn('credentials', {
        email: email.trim(),
        password,
        role: 'admin',
        redirect: false,
        callbackUrl: '/admin/dashboard',
      });

      if (r?.error) {
        setError('Invalid email or password. Make sure these exactly match the admin account created in the production database.');
        setLoading(false);
        return;
      }

      window.location.href = r?.url || '/admin/dashboard';
    } catch {
      setError('Unable to sign in right now. Please check the deployment and authentication configuration.');
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070b16] px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl items-center justify-center sm:min-h-[calc(100vh-5rem)]">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/95 shadow-[0_30px_100px_rgba(0,0,0,.45)] backdrop-blur-xl md:grid-cols-[1.05fr_.95fr]">
          <section className="relative hidden min-h-[620px] overflow-hidden bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-950 p-10 text-white md:flex md:flex-col md:justify-between lg:p-14">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <Link href="/" className="inline-flex items-center gap-2 text-2xl font-black tracking-tight">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-indigo-700 shadow-lg">Z</span>
                zenvora<span className="text-violet-200">.</span>
              </Link>
            </div>
            <div className="relative max-w-md">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[.2em] text-indigo-100">Admin workspace</span>
              <h1 className="mt-5 text-5xl font-black leading-[1.05] tracking-tight lg:text-6xl">Your store.<br />Your control.</h1>
              <p className="mt-6 text-base leading-7 text-indigo-100">Securely manage products, orders, customers and store operations from one polished workspace.</p>
              <div className="mt-8 grid grid-cols-3 gap-3">
                {['Products', 'Orders', 'Insights'].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center text-xs font-bold backdrop-blur">{item}</div>
                ))}
              </div>
            </div>
            <p className="relative text-xs text-indigo-200">Protected administrator access</p>
          </section>

          <section className="flex min-h-[620px] items-center p-6 sm:p-10 lg:p-14">
            <div className="w-full">
              <div className="mb-8 flex items-center justify-between md:hidden">
                <Link href="/" className="flex items-center gap-2 text-xl font-black">zenvora<span className="text-violet-600">.</span></Link>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">Admin</span>
              </div>

              <Link href="/" className="text-sm font-semibold text-slate-500 transition hover:text-violet-700">← Back to store</Link>
              <div className="mt-8">
                <p className="text-sm font-black uppercase tracking-[.2em] text-violet-600">Welcome back</p>
                <h2 className="mt-2 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Sign in</h2>
                <p className="mt-3 text-sm leading-6 text-slate-500">Enter your administrator credentials to continue.</p>
              </div>

              <form onSubmit={submit} className="mt-8 space-y-5">
                <label className="block text-sm font-bold text-slate-700">
                  Email address
                  <input required autoComplete="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                    placeholder="admin@example.com" />
                </label>

                <label className="block text-sm font-bold text-slate-700">
                  Password
                  <div className="relative mt-2">
                    <input required autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                      className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-20 text-base outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:ring-4 focus:ring-violet-100"
                      placeholder="Enter your password" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-900">
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>

                {error && <div role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">{error}</div>}

                <button disabled={loading} className="group flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 font-black text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-violet-700 hover:shadow-violet-700/20 disabled:cursor-not-allowed disabled:opacity-60">
                  {loading ? 'Signing you in…' : 'Continue to dashboard'}
                  {!loading && <span className="transition group-hover:translate-x-1">→</span>}
                </button>
              </form>

              <p className="mt-7 text-center text-xs leading-5 text-slate-400">Administrator access only. Your session is protected by secure authentication.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}