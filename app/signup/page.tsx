'use client';

import Link from 'next/link';
import { FormEvent,useState } from 'react';
import { signIn } from 'next-auth/react';
import StoreHeader from '../../components/store-header';

type SignInResult={error?:string;url?:string}|undefined;

export default function Signup(){
  const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [show,setShow]=useState(false);const [verification,setVerification]=useState(false);const [otp,setOtp]=useState('');
  async function googleSignIn(){setError('');setLoading(true);try{const r=await signIn('google',{callbackUrl:'/account'}) as SignInResult;if(r?.error){setError('Google sign-in is not configured correctly yet.');setLoading(false)}}catch{setError('Google sign-in is temporarily unavailable.');setLoading(false)}}
  async function submit(e:FormEvent){e.preventDefault();setError('');if(password!==confirm&&!verification){setError('Passwords do not match.');return}setLoading(true);try{let signInResult:SignInResult;if(verification){const res=await fetch('/api/auth/signup/verify-otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,otp})});const result=await res.json();if(!res.ok){setError(result.error||'Invalid verification code.');setLoading(false);return}}else{const res=await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,email,password})});const result=await res.json();if(!res.ok){setError(result.error||'Unable to send verification code.');setLoading(false);return}setVerification(true);setLoading(false);return}signInResult=await signIn('credentials',{email:email.trim(),password,role:'customer',redirect:false,callbackUrl:'/account'}) as SignInResult;if(signInResult?.error){setError('Account created, but automatic sign-in failed. Please sign in manually.');setLoading(false);return}window.location.href=signInResult?.url||'/account'}catch{setError('Unable to create your account right now.');setLoading(false)}}
  return (
    <main id="main-content" className="store-shell min-h-screen">
      <StoreHeader />
      <div className="store-container py-6 sm:py-10">
        <div className="store-auth-layout">
          <section className="store-auth-side is-signup">
            <div className="store-auth-side-grid" aria-hidden="true" />
            <Link href="/" className="store-logo"><span className="store-logo-mark">Z</span><span>zenvora<span className="text-fuchsia-200">.</span></span></Link>
            <div className="relative mt-auto max-w-md pb-3">
              <span className="store-eyebrow border-white/15 bg-white/10 text-fuchsia-100"><span className="store-eyebrow-dot bg-fuchsia-200" /> New customer</span>
              <h1 className="mt-6 text-4xl font-black leading-[1.02] tracking-[-.045em] text-white sm:text-5xl">Good products.<br /><span className="text-fuchsia-200">Better days.</span></h1>
              <p className="mt-5 text-sm leading-7 text-fuchsia-100/75">Create your Zenvora account and keep your shopping experience connected.</p>
            </div>
          </section>

          <section className="store-auth-form">
            <div className="mx-auto w-full max-w-sm">
              <Link href="/" className="text-xs font-extrabold text-slate-400 hover:text-violet-700">← Back to store</Link>
              <p className="store-kicker mt-6">{verification?'Verification step':'New customer'}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{verification?'Verify your email':'Create account'}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{verification?<>Enter the 6-digit code sent to <b className="text-slate-800">{email}</b>.</>:'Create your customer account in a few simple steps.'}</p>

              {!verification&&<><button type="button" onClick={googleSignIn} disabled={loading} className="store-google-btn mt-6"><span className="font-black text-slate-700">G</span> Continue with Google</button><div className="my-5 flex items-center gap-3 text-[9px] font-black text-slate-400"><span className="h-px flex-1 bg-slate-200"/><span>OR</span><span className="h-px flex-1 bg-slate-200"/></div></>}

              <form onSubmit={submit} className="space-y-4">
                {!verification&&<>
                  <label className="store-field-label">Full name<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your full name"/></label>
                  <label className="store-field-label">Email address<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com"/></label>
                  <label className="store-field-label">Password<div className="relative"><input required minLength={12} type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" placeholder="At least 12 characters" className="pr-16"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1.5 text-[10px] font-black text-slate-400 hover:bg-slate-100">{show?'Hide':'Show'}</button></div></label>
                  <label className="store-field-label">Confirm password<input required minLength={12} type={show?'text':'password'} value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repeat your password"/></label>
                </>}
                {verification&&<label className="store-field-label">Verification code<input required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value.replace(/\D/g,''))} autoComplete="one-time-code" placeholder="123456" className="text-center text-xl font-black tracking-[.5em]"/></label>}
                {error&&<div role="alert" className="store-error-box">{error}</div>}
                <button disabled={loading} className="store-primary-btn h-12 w-full disabled:opacity-55">{loading?(verification?'Verifying…':'Sending code…'):(verification?'Verify & create account':'Send verification code')}<span>→</span></button>
                {verification&&<button type="button" onClick={()=>{setVerification(false);setOtp('');setError('')}} className="w-full text-xs font-extrabold text-slate-400 hover:text-slate-700">← Change details</button>}
              </form>
              <p className="mt-5 text-center text-xs text-slate-400">Already have an account? <Link href="/login" className="font-extrabold text-violet-700">Sign in</Link></p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
