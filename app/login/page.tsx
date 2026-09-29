'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function CustomerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await signIn('credentials', { email: email.trim(), password, role: 'customer', redirect: false, callbackUrl: '/account' });
      const result = r as { error?: string; url?: string } | undefined;
      if (result?.error) {
        setError('Invalid email or password.');
        setLoading(false);
        return;
      }
      window.location.href = result?.url || '/account';
    } catch {
      setError('Unable to sign in right now. Please try again.');
      setLoading(false);
    }
  }

  async function googleSignIn() {
    setError('');
    setLoading(true);
    try {
      const r = await signIn('google', { callbackUrl: '/account' });
      const result = r as { error?: string; url?: string } | undefined;
      if (result?.error) {
        setError('Google sign-in is not configured correctly yet.');
        setLoading(false);
      }
    } catch {
      setError('Google sign-in is temporarily unavailable.');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f8fc] px-3 py-3 text-slate-900 sm:px-5 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-6xl overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl shadow-violet-950/10 sm:min-h-[calc(100vh-3rem)] md:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#171047] via-[#4b2ab7] to-[#8b3fe5] p-8 text-white md:flex md:flex-col md:justify-between lg:p-11">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-fuchsia-400/25 blur-3xl" />
          <div className="absolute -bottom-32 left-[30%] h-64 w-64 rounded-full bg-cyan-300/15 blur-3xl" />
          <Link href="/" className="relative text-xl font-black">Zenvora<span className="text-cyan-200">.</span></Link>
          <div className="relative max-w-md">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-violet-100">Welcome back</span>
            <h1 className="mt-5 text-5xl font-black leading-[.98] tracking-[-.04em]">Big deals.<br /><span className="text-cyan-200">Better shopping.</span></h1>
            <p className="mt-5 text-sm leading-7 text-violet-100/80">Keep your orders, saved addresses and account details connected while you shop.</p>
            <div className="mt-7 grid grid-cols-3 gap-2">
              {['Secure checkout','Easy returns','Fast support'].map(item => <div key={item} className="rounded-2xl border border-white/10 bg-white/10 p-3 text-center text-[10px] font-bold text-violet-100">{item}</div>)}
            </div>
          </div>
          <p className="relative text-[10px] text-violet-200/70">Zenvora · Shop smarter. Live better.</p>
        </section>

        <section className="flex items-center px-4 py-6 sm:px-8 sm:py-10 lg:px-12">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-6 flex items-center justify-between md:hidden">
              <Link href="/" className="text-lg font-black tracking-tight">Zenvora<span className="text-fuchsia-500">.</span></Link>
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-700">Customer</span>
            </div>

            <Link href="/" className="text-xs font-bold text-slate-400 hover:text-violet-700">← Back to store</Link>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-600">Account access</p>
            <h1 className="mt-1 text-3xl font-black tracking-[-.03em] sm:text-4xl">Sign in</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Access your orders, wishlist and shopping account.</p>

            <button type="button" onClick={googleSignIn} disabled={loading} className="mt-6 h-12 w-full rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-800 shadow-sm hover:border-violet-300 hover:bg-violet-50 disabled:opacity-60">Continue with Google</button>
            <div className="my-5 flex items-center gap-3 text-[10px] font-black text-slate-400"><span className="h-px flex-1 bg-slate-200" /><span>OR</span><span className="h-px flex-1 bg-slate-200" /></div>

            <form onSubmit={submit} className="space-y-4">
              <label className="block text-xs font-black text-slate-700">Email address<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" /></label>
              <label className="block text-xs font-black text-slate-700">Password<div className="relative mt-1.5"><input required type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-16 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/10" /><button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[10px] font-black text-slate-400 hover:bg-violet-50 hover:text-violet-700">{show ? 'Hide' : 'Show'}</button></div></label>

              {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700">{error}</div> : null}

              <button disabled={loading} className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-700 via-violet-600 to-fuchsia-500 text-sm font-black text-white shadow-lg shadow-violet-500/20 hover:-translate-y-0.5 disabled:opacity-60">{loading ? 'Signing in…' : 'Sign In →'}</button>
            </form>

            <div className="mt-5 flex items-center justify-between gap-3 text-[11px]">
              <Link href="/forgot-password" className="font-black text-violet-700 hover:text-fuchsia-600">Forgot password?</Link>
              <span className="text-right text-slate-500">Need an account? <Link href="/signup" className="font-black text-violet-700 hover:text-fuchsia-600">Create one</Link></span>
            </div>
            <Link href="/admin/login" className="mt-5 block text-center text-[10px] text-slate-300 hover:text-slate-500">Administrator login</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
