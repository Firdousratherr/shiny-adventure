'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Log={id:string;adminEmail:string;action:string;entityType:string;entityId:string|null;details:unknown;createdAt:string};

export default function AuditPage(){
 const [logs,setLogs]=useState<Log[]>([]);const [forbidden,setForbidden]=useState(false);const [loading,setLoading]=useState(true);
 useEffect(()=>{fetch('/api/admin/audit?limit=100').then(async r=>{const j=await r.json();if(r.status===403){setForbidden(true);return}setLogs(j.logs||[])}).finally(()=>setLoading(false))},[]);
 return <main className="min-h-screen bg-slate-100"><header className="sticky top-0 z-30 border-b bg-white"><div className="container flex min-h-16 items-center justify-between"><Link href="/admin/dashboard" className="text-xl font-black">zenvora<span className="text-indigo-600">.</span><span className="ml-2 text-xs uppercase tracking-widest text-slate-400">Owner</span></Link><Link href="/admin/dashboard" className="rounded-xl px-3 py-2 text-sm font-bold">← Dashboard</Link></div></header><div className="container py-8">{forbidden?<div className="rounded-2xl bg-white p-8 text-center"><h1 className="text-xl font-black">Super administrator access required</h1></div>:<><p className="text-xs font-black uppercase tracking-widest text-indigo-600">Security & accountability</p><h1 className="mt-1 text-3xl font-black">Activity log</h1><p className="mt-2 text-sm text-slate-500">A chronological record of important administrative changes.</p><div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">{loading?<div className="p-8 text-center text-sm text-slate-500">Loading…</div>:logs.length===0?<div className="p-8 text-center font-semibold">No activity recorded yet.</div>:<div className="divide-y">{logs.map(l=><div key={l.id} className="p-4 sm:p-5"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-black">{l.action.replaceAll('_',' ')}</p><p className="mt-1 text-sm text-slate-500">{l.adminEmail} · {l.entityType}{l.entityId?' · '+l.entityId:''}</p></div><time className="text-xs text-slate-400">{new Date(l.createdAt).toLocaleString('en-IN')}</time></div>{l.details&&<pre className="mt-3 overflow-auto rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">{String(JSON.stringify(l.details,null,2) ?? '')}</pre>}</div>)}</div>}</div></>}</div></main>;
}
