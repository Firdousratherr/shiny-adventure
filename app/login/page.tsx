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
      const r = await signIn('credentials', {
        email: email.trim(),
        password,
        role: 'customer',
        redirect: false,
        callbackUrl: '/account',
      });
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
    <main className="min-h-screen bg-[#070b16] px-3 py-3 text-white sm:px-5 sm:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c1222] shadow-2xl sm:min-h-[calc(100vh-3rem)] sm:rounded-[1.5rem] md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-violet-700 via-indigo-700 to-slate-950 p-8 md:flex lg:p-10">
          <Link href="/" className="text-xl font-black">🛍️ Zenvora<span className="text-violet-200">.</span></Link>
          <div className="max-w-sm">
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-indigo-100">Premium products · Better living</span>
            <h1 className="mt-5 text-4xl font-black leading-tight lg:text-5xl">Shop smart.<br /><span className="text-fuchsia-200">Live better.</span></h1>
            <p className="mt-4 text-sm leading-6 text-indigo-100">Keep your orders, wishlist and shopping experience connected across devices.</p>
            <div className="mt-6 grid grid-cols-3 gap-2">{['Fast delivery', 'Secure payments', 'Easy returns'].map(x => <div key={x} className="rounded-xl border border-white/10 bg-white/10 p-2 text-center text-[10px] font-bold">{x}</div>)}</div>
          </div>
          <p className="text-[10px] text-indigo-200">Zenvora · Shopping made simple</p>
        </section>

        <section className="flex items-center px-4 py-5 sm:px-8 sm:py-8 lg:px-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-5 flex items-center justify-between md:hidden">
              <Link href="/" className="text-lg font-black">🛍️ Zenvora<span className="text-fuchsia-400">.</span></Link>
              <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-[10px] font-bold text-violet-200">Customer</span>
            </div>

            <Link href="/" className="text-xs font-semibold text-slate-400 hover:text-white">← Back to store</Link>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[.2em] text-fuchsia-400">Welcome back</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Sign in</h1>
            <p className="mt-2 text-xs leading-5 text-slate-400">Access your orders, wishlist and account.</p>

            <button type="button" onClick={googleSignIn} disabled={loading} className="mt-5 h-12 w-full rounded-xl border border-white/10 bg-white/5 text-sm font-black transition hover:bg-white/10 disabled:opacity-60">
              Continue with Google
            </button>

            <div className="my-4 flex items-center gap-3 text-[10px] font-semibold text-slate-500"><span className="h-px flex-1 bg-white/10" /><span>OR</span><span className="h-px flex-1 bg-white/10" /></div>

            <form onSubmit={submit} className="space-y-3.5">
              <label className="block text-xs font-bold text-slate-200">
                Email address
                <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" />
              </label>

              <label className="block text-xs font-bold text-slate-200">
                Password
                <div className="relative mt-1.5">
                  <input required type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 pr-16 text-sm text-white outline-none placeholder:text-slate-500 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:bg-white/10">{show ? 'Hide' : 'Show'}</button>
                </div>
              </label>

              {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-xs font-semibold text-red-300">{error}</div>}

              <button disabled={loading} className="h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-sm font-black shadow-lg shadow-violet-900/20 transition hover:-translate-y-0.5 disabled:opacity-60">{loading ? 'Signing in…' : 'Sign In →'}</button>
            </form>

            <div className="mt-5 flex items-center justify-between gap-3 text-[11px]">
              <Link href="/forgot-password" className="font-bold text-fuchsia-400 hover:text-fuchsia-300">Forgot password?</Link>
              <span className="text-right text-slate-500">Need an account? <Link href="/signup" className="font-bold text-fuchsia-400 hover:text-fuchsia-300">Create one</Link></span>
            </div>
            <Link href="/admin/login" className="mt-4 block text-center text-[10px] text-slate-600 hover:text-slate-400">Administrator login</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
