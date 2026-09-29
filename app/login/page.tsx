'use client';

import Link from 'next/link';
import { FormEvent,useState } from 'react';
import { signIn } from 'next-auth/react';
import StoreHeader from '../../components/store-header';

export default function CustomerLogin(){
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const [show,setShow]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{const r=await signIn('credentials',{email:email.trim(),password,role:'customer',redirect:false,callbackUrl:'/account'});const result=r as {error?:string;url?:string}|undefined;if(result?.error){setError('Invalid email or password.');setLoading(false);return}window.location.href=result?.url||'/account'}catch{setError('Unable to sign in right now. Please try again.');setLoading(false)}}
  async function googleSignIn(){setError('');setLoading(true);try{const r=await signIn('google',{callbackUrl:'/account'});const result=r as {error?:string;url?:string}|undefined;if(result?.error){setError('Google sign-in is not configured correctly yet.');setLoading(false)}}catch{setError('Google sign-in is temporarily unavailable.');setLoading(false)}}
  return (
    <main id="main-content" className="store-shell min-h-screen">
      <StoreHeader />
      <div className="store-container py-6 sm:py-10">
        <div className="store-auth-layout">
          <section className="store-auth-side">
            <div className="store-auth-side-grid" aria-hidden="true" />
            <Link href="/" className="store-logo"><span className="store-logo-mark">Z</span><span>zenvora<span className="text-violet-200">.</span></span></Link>
            <div className="relative mt-auto max-w-md pb-3">
              <span className="store-eyebrow border-white/15 bg-white/10 text-violet-100"><span className="store-eyebrow-dot bg-violet-200" /> Welcome back</span>
              <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-.045em] text-white sm:text-5xl">Your shopping, <span className="text-violet-200">in one place.</span></h1>
              <p className="mt-5 text-sm leading-7 text-violet-100/75">Keep orders, saved addresses and your account details connected across devices.</p>
              <div className="mt-7 grid grid-cols-3 gap-2"><div className="store-auth-side-pill">🚚 Fast delivery</div><div className="store-auth-side-pill">🔒 Secure checkout</div><div className="store-auth-side-pill">↻ Easy returns</div></div>
            </div>
            <p className="relative text-[10px] font-bold text-violet-100/50">Shop smart. Live better.</p>
          </section>

          <section className="store-auth-form">
            <div className="mx-auto w-full max-w-sm">
              <Link href="/" className="text-xs font-extrabold text-slate-400 hover:text-violet-700">← Back to store</Link>
              <p className="store-kicker mt-6">Customer account</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Access your orders and continue where you left off.</p>

              <button type="button" onClick={googleSignIn} disabled={loading} className="store-google-btn mt-6"><span className="font-black text-slate-700">G</span> Continue with Google</button>
              <div className="my-5 flex items-center gap-3 text-[9px] font-black text-slate-400"><span className="h-px flex-1 bg-slate-200"/><span>OR CONTINUE WITH EMAIL</span><span className="h-px flex-1 bg-slate-200"/></div>

              <form onSubmit={submit} className="space-y-4">
                <label className="store-field-label">Email address<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
                <label className="store-field-label">Password<div className="relative"><input required type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password" className="pr-16"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-[10px] font-black text-slate-400 hover:bg-slate-100">{show?'Hide':'Show'}</button></div></label>
                {error&&<div role="alert" className="store-error-box">{error}</div>}
                <button disabled={loading} className="store-primary-btn h-12 w-full disabled:opacity-55">{loading?'Signing in…':'Sign in'}<span>→</span></button>
              </form>

              <div className="mt-5 flex items-center justify-between gap-3 text-[11px]"><Link href="/forgot-password" className="font-extrabold text-violet-700">Forgot password?</Link><span className="text-right text-slate-400">Need an account? <Link href="/signup" className="font-extrabold text-violet-700">Create one</Link></span></div>
              <Link href="/admin/login" className="mt-5 block text-center text-[10px] font-bold text-slate-400 hover:text-slate-700">Administrator login</Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
