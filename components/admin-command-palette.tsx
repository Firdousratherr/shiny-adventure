'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Result={type:string;id:string;title:string;subtitle:string;href:string};

export default function AdminCommandPalette(){
  const [open,setOpen]=useState(false); const [q,setQ]=useState(''); const [results,setResults]=useState<Result[]>([]);
  useEffect(()=>{const on=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setOpen(v=>!v)}if(e.key==='Escape')setOpen(false)};window.addEventListener('keydown',on);return()=>window.removeEventListener('keydown',on)},[]);
  useEffect(()=>{if(!open||!q.trim()){setResults([]);return}const t=setTimeout(async()=>{const r=await fetch('/api/admin/search?q='+encodeURIComponent(q));const j=await r.json();setResults(j.results||[])},180);return()=>clearTimeout(t)},[q,open]);
  return <>
    <button type="button" onClick={()=>setOpen(true)} className="flex h-10 w-full max-w-xl items-center justify-between rounded-xl border border-white/10 bg-white/[.04] px-3 text-left text-sm text-slate-400 hover:bg-white/[.07]">
      <span>Search orders, products, customers…</span><kbd className="hidden rounded-md border border-white/10 px-2 py-0.5 text-[10px] sm:block">Ctrl K</kbd>
    </button>
    {open&&<div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 p-3 pt-[10vh] backdrop-blur-sm">
      <button className="absolute inset-0" aria-label="Close search" onClick={()=>setOpen(false)}/>
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0c1224] shadow-2xl">
        <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search orders, products, customers, tickets…" className="h-14 w-full border-0 border-b border-white/10 bg-transparent px-5 text-white outline-none" />
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {!q&&<div className="p-5 text-sm text-slate-500">Type to search. Use Ctrl/⌘ + K anytime in the admin.</div>}
          {q&&results.length===0&&<div className="p-5 text-sm text-slate-500">No matching records.</div>}
          {results.map(x=><Link key={x.type+x.id} href={x.href} onClick={()=>setOpen(false)} className="block rounded-xl p-3 hover:bg-white/[.06]"><div className="flex items-center justify-between gap-3"><b className="text-sm text-white">{x.title}</b><span className="text-[10px] uppercase tracking-wider text-violet-400">{x.type}</span></div><p className="mt-1 text-xs text-slate-500">{x.subtitle}</p></Link>)}
        </div>
      </div>
    </div>}
  </>;
}
