'use client';

import { useState } from 'react';

type Preview = {
  provider: 'AMAZON' | 'FLIPKART' | 'MEESHO';
  externalId: string;
  title: string;
  description?: string;
  sourceCost: number;
  images: string[];
  sourceUrl: string;
  sellingPrice: number;
  markupPercent: number;
  automatic: boolean;
  scrapeWarning?: string;
  sourceCategoryName?: string;
  matchedCategoryId?: string;
  matchedCategoryName?: string;
};

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export default function MarketplaceImporter({ categories }: { categories: CategoryOption[] }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [sourceCost, setSourceCost] = useState('');
  const [description, setDescription] = useState('');
  const [markup, setMarkup] = useState('30');
  const [imageUrls, setImageUrls] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const request = async (action: 'preview' | 'import') => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/admin/products/import-marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sourceUrl: url,
          name,
          sourceCost: Number(sourceCost),
          description,
          markupPercent: Number(markup),
          imageUrls: imageUrls.split(/\r?\n|,/).map(v => v.trim()).filter(Boolean),
          categoryId: selectedCategoryId || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to process product.');
      if (action === 'preview') {
        setPreview(j.product);
        setSelectedCategoryId(j.product.matchedCategoryId || '');
        if (j.product.title) setName(j.product.title);
        if (j.product.description) setDescription(j.product.description);
        if (j.product.sourceCost) setSourceCost(String(j.product.sourceCost));
        if (j.product.images?.length) setImageUrls(j.product.images.join('\n'));
      } else {
        alert(`Imported as DRAFT. Product ID: ${j.productId}`);
        location.reload();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to process product.');
    } finally {
      setBusy(false);
    }
  };

  const providerLabel = preview?.provider === 'AMAZON' ? 'Amazon' : preview?.provider === 'FLIPKART' ? 'Flipkart' : 'Meesho';

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-indigo-600">Marketplace importer</p>
          <h2 className="text-xl font-black">Amazon · Flipkart · Meesho</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Paste a direct public product URL. Zenvora first tries the page directly, then uses ScrapingBee when configured, extracts the title, price, description and images, and lets you review everything before importing.
          </p>
        </div>
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Automatic + manual fallback</span>
      </div>

      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        Automatic extraction requires <b>SCRAPINGBEE_API_KEY</b> in Vercel when a marketplace blocks direct server requests. The importer does not bypass logins or private pages; use public product pages and content you are permitted to reuse.
      </div>

      <div className="mt-4 grid gap-3">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="Amazon / Flipkart / Meesho product URL" className="w-full rounded-xl border px-3 py-3" inputMode="url" />
          <a href={url || '#'} target="_blank" rel="noreferrer" className="rounded-xl border px-5 py-3 text-center font-bold text-slate-700 hover:bg-slate-50">Open product</a>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Title — filled automatically" className="w-full rounded-xl border px-3 py-3" />
          <input value={sourceCost} onChange={e => setSourceCost(e.target.value)} placeholder="Source price ₹ — filled automatically" className="w-full rounded-xl border px-3 py-3" inputMode="decimal" />
        </div>

        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description — filled automatically when available" className="min-h-24 w-full rounded-xl border px-3 py-3" />

        <div className="grid gap-3 md:grid-cols-[150px_1fr_auto]">
          <input value={markup} onChange={e => setMarkup(e.target.value)} placeholder="Markup %" className="w-full rounded-xl border px-3 py-3" inputMode="decimal" />
          <textarea value={imageUrls} onChange={e => setImageUrls(e.target.value)} placeholder="Image URLs — automatically filled; you can replace them with permitted URLs" className="min-h-12 w-full rounded-xl border px-3 py-3" />
          <button disabled={busy || !url.trim()} onClick={() => request('preview')} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Reading product…' : 'Fetch & preview'}</button>
        </div>
      </div>

      {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}

      {preview && (
        <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">{providerLabel} · {preview.automatic ? 'Automatically extracted' : 'Manual fallback'}</p>
              <h3 className="mt-1 text-lg font-black">{preview.title}</h3>
            </div>
            <div className="text-right"><p className="text-xs text-slate-500">Your price</p><p className="text-2xl font-black">₹{Number(preview.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p></div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[120px_1fr]">
            {preview.images?.[0] ? <img src={preview.images[0]} alt={preview.title} className="aspect-square w-full rounded-xl object-cover" /> : <div className="aspect-square rounded-xl bg-slate-200" />}
            <div>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-white px-3 py-1">{providerLabel} · Source ₹{Number(preview.sourceCost).toLocaleString('en-IN')}</span>
                <span className="rounded-full bg-white px-3 py-1">Markup {preview.markupPercent}%</span>
                <span className="rounded-full bg-white px-3 py-1 font-bold">Zenvora ₹{Number(preview.sellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {preview.scrapeWarning && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">{preview.scrapeWarning} Review the manually supplied fields before importing.</p>}
              <div className="mt-3 rounded-xl border bg-white p-3">
                <label className="text-xs font-black uppercase tracking-wide text-slate-500">Zenvora category</label>
                {preview.sourceCategoryName ? (
                  <p className="mt-1 text-xs text-slate-600">Source category detected: <b>{preview.sourceCategoryName}</b>{preview.matchedCategoryName ? <> · matched to <b>{preview.matchedCategoryName}</b></> : ' · no matching Zenvora category found.'}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">Source category was not detected. Choose a category manually; no new category will be created automatically.</p>
                )}
                <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3">
                  <option value="">Leave uncategorized</option>
                  {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </div>
              <p className="mt-3 text-xs text-slate-500">The product is created as DRAFT with stock 0. Images are copied to Vercel Blob when possible. Imports no longer create categories automatically.</p>
              <button disabled={busy} onClick={() => request('import')} className="mt-4 rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Importing…' : 'Import to Zenvora'}</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
