'use client';

import {useState} from 'react';

export default function MarketplaceImporter(){
  const [url,setUrl]=useState('');
  const [name,setName]=useState('');
  const [sourceCost,setSourceCost]=useState('');
  const [description,setDescription]=useState('');
  const [markup,setMarkup]=useState('30');
  const [imageUrls,setImageUrls]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [preview,setPreview]=useState<any>(null);

  const request=async(action:'preview'|'import')=>{
    setBusy(true);
    setError('');
    try{
      const r=await fetch('/api/admin/products/import-marketplace',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          action,
          sourceUrl:url,
          name,
          sourceCost:Number(sourceCost),
          description,
          markupPercent:Number(markup),
          imageUrls:imageUrls.split(/\r?\n|,/).map(v=>v.trim()).filter(Boolean),
        }),
      });
      const j=await r.json();
      if(!r.ok)throw new Error(j.error);
      if(action==='preview')setPreview(j.product);
      else{
        alert('Imported as DRAFT. Product ID: '+j.productId);
        location.reload();
      }
    }catch(e){
      setError(e instanceof Error?e.message:'Unable to process product.');
    }finally{
      setBusy(false);
    }
  };

  return <section className="rounded-2xl bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-bold text-indigo-600">Marketplace importer</p>
        <h2 className="text-xl font-black">Amazon & Flipkart — No API required</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Open the product page, copy its title and current price, paste them here, then Zenvora calculates your markup and creates a draft.
          This avoids requiring Amazon or Flipkart API credentials.
        </p>
      </div>
      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Assisted import</span>
    </div>

    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      Automatic scraping of Amazon/Flipkart pages is not used. Both platforms restrict automated page scraping, so this importer does not bypass those controls.
      Only import content, images and pricing you are permitted to reuse.
    </div>

    <div className="mt-4 grid gap-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Amazon or Flipkart product URL" className="w-full rounded-xl border px-3 py-3" inputMode="url"/>
        <a href={url||'#'} target="_blank" rel="noreferrer" className="rounded-xl border px-5 py-3 text-center font-bold text-slate-700 hover:bg-slate-50">Open product page</a>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Product title" className="w-full rounded-xl border px-3 py-3"/>
        <input value={sourceCost} onChange={e=>setSourceCost(e.target.value)} placeholder="Current source price (₹)" className="w-full rounded-xl border px-3 py-3" inputMode="decimal"/>
      </div>
      <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Description (optional)" className="min-h-24 w-full rounded-xl border px-3 py-3"/>
      <div className="grid gap-3 md:grid-cols-[150px_1fr_auto]">
        <input value={markup} onChange={e=>setMarkup(e.target.value)} placeholder="Markup %" className="w-full rounded-xl border px-3 py-3" inputMode="decimal"/>
        <textarea value={imageUrls} onChange={e=>setImageUrls(e.target.value)} placeholder="Optional permitted image URLs — one per line" className="min-h-12 w-full rounded-xl border px-3 py-3"/>
        <button disabled={busy||!url.trim()||!name.trim()||!sourceCost} onClick={()=>request('preview')} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'Working…':'Preview product'}</button>
      </div>
    </div>

    {error&&<p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

    {preview&&<div className="mt-5 grid gap-4 rounded-2xl border bg-slate-50 p-4 md:grid-cols-[120px_1fr]">
      {preview.images?.[0]&&<img src={preview.images[0]} alt={preview.title} className="aspect-square w-full rounded-xl object-cover"/>}
      <div>
        <h3 className="font-black">{preview.title}</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-white px-3 py-1">{preview.provider==='AMAZON'?'Amazon':'Flipkart'} · Source ₹{Number(preview.sourceCost).toLocaleString('en-IN')}</span>
          <span className="rounded-full bg-white px-3 py-1">Markup {preview.markupPercent}%</span>
          <span className="rounded-full bg-white px-3 py-1 font-bold">Zenvora ₹{Number(preview.sellingPrice).toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">Product will be created as DRAFT with stock 0. You can add or upload permitted images in the product editor.</p>
        <button disabled={busy} onClick={()=>request('import')} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy?'Importing…':'Import to Zenvora'}</button>
      </div>
    </div>}
  </section>;
}
