'use client';

import { useEffect, useMemo, useState } from 'react';
import MarketplaceImporter from './marketplace-importer';

type I = {
  id: string;
  url: string;
  altText: string;
  sortOrder: number;
};

type P = {
  id: string;
  name: string;
  slug: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  sellingPrice: string;
  sourceCost: string;
  stock: number;
  categoryId: string;
  categoryName: string;
  featured: boolean;
  status: string;
  images: I[];
};

type C = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
};

type InputMode = 'search' | 'email' | 'none' | 'url' | 'text' | 'tel' | 'decimal' | 'numeric';
type Status = 'DRAFT' | 'ACTIVE' | 'HIDDEN' | 'OUT_OF_STOCK';

type EditState = {
  name: string;
  slug: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  sellingPrice: string;
  sourceCost: string;
  stock: string;
  categoryId: string;
  featured: boolean;
  status: Status;
};

const statuses: Status[] = ['DRAFT', 'ACTIVE', 'HIDDEN', 'OUT_OF_STOCK'];

function money(value: string | number) {
  const n = Number(value);
  return Number.isFinite(n)
    ? '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '₹0.00';
}

function productImage(src: string) {
  return src || '';
}

function ImageTile({
  src,
  alt,
  label,
  compact = false,
}: {
  src?: string;
  alt: string;
  label?: string;
  compact?: boolean;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className={compact
        ? 'flex aspect-square w-full items-center justify-center bg-slate-100 text-center text-[9px] font-black uppercase tracking-wide text-slate-400'
        : 'flex aspect-square w-full items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-[10px] font-black uppercase tracking-wide text-slate-400'}>
        <span>{src ? 'Image unavailable' : 'No image'}</span>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-slate-100">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setBroken(true)}
      />
      {label && (
        <span className="absolute left-2 top-2 rounded-full bg-slate-950/80 px-2 py-1 text-[9px] font-black text-white">
          {label}
        </span>
      )}
    </div>
  );
}

export default function ProductAdmin({
  initialProducts,
  categories,
}: {
  initialProducts: P[];
  categories: C[];
}) {
  const [products, setProducts] = useState(initialProducts);
  const [categoryList, setCategoryList] = useState(categories);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [showCreate, setShowCreate] = useState(false);
  const [pendingCategoryDelete, setPendingCategoryDelete] = useState<string | null>(null);
  const [replacementCategoryId, setReplacementCategoryId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    metaTitle: '',
    metaDescription: '',
    canonicalUrl: '',
    sellingPrice: '',
    sourceCost: '',
    stock: '0',
    categoryId: '',
    featured: false,
    status: 'DRAFT' as Status,
  });
  const [cat, setCat] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [alt, setAlt] = useState<Record<string, string>>({});

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('edit');
    if (!id) return;
    const product = initialProducts.find(p => p.id === id);
    if (!product) return;
    setEditing(product.id);
    setEdit({
      name: product.name,
      slug: product.slug,
      description: product.description,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
      canonicalUrl: product.canonicalUrl,
      sellingPrice: product.sellingPrice,
      sourceCost: product.sourceCost,
      stock: String(product.stock),
      categoryId: product.categoryId,
      featured: product.featured,
      status: product.status as Status,
    });
  }, [initialProducts]);

  const stats = useMemo(() => ({
    total: products.length,
    active: products.filter(p => p.status === 'ACTIVE').length,
    drafts: products.filter(p => p.status === 'DRAFT').length,
    needsStock: products.filter(p => p.stock <= 0 && p.status !== 'HIDDEN').length,
    hidden: products.filter(p => p.status === 'HIDDEN').length,
  }), [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = products.filter(p => {
      const matchesText = !query
        || p.name.toLowerCase().includes(query)
        || p.slug.toLowerCase().includes(query)
        || p.categoryName.toLowerCase().includes(query);
      const matchesStatus = filterStatus === 'ALL' || p.status === filterStatus;
      const matchesCategory = filterCategory === 'ALL' || p.categoryId === filterCategory;
      return matchesText && matchesStatus && matchesCategory;
    });

    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price-high') return Number(b.sellingPrice) - Number(a.sellingPrice);
      if (sortBy === 'stock-low') return a.stock - b.stock;
      return 0;
    });
  }, [products, search, filterStatus, filterCategory, sortBy]);

  const visibleIds = filteredProducts.map(p => p.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));
  const selectedCount = selected.length;
  const editingProduct = editing ? products.find(p => p.id === editing) || null : null;
  const editProfit = edit && Number.isFinite(Number(edit.sellingPrice))
    ? Number(edit.sellingPrice) - (Number(edit.sourceCost) || 0)
    : 0;
  const editMargin = edit && Number(edit.sellingPrice) > 0
    ? (editProfit / Number(edit.sellingPrice)) * 100
    : 0;

  const begin = (p: P) => {
    setEditing(p.id);
    setEdit({
      name: p.name,
      slug: p.slug,
      description: p.description,
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      canonicalUrl: p.canonicalUrl,
      sellingPrice: p.sellingPrice,
      sourceCost: p.sourceCost,
      stock: String(p.stock),
      categoryId: p.categoryId,
      featured: p.featured,
      status: p.status as Status,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeEditor = () => {
    setEditing(null);
    setEdit(null);
    if (new URLSearchParams(window.location.search).has('edit')) {
      window.history.replaceState({}, '', '/admin/products');
    }
  };

  const create = async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, stock: Number(form.stock) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Unable to create product.');
      const id = j.product?.id;
      if (id) {
        window.location.href = '/admin/products?edit=' + encodeURIComponent(id);
      } else {
        window.location.reload();
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to create product.');
    } finally {
      setBusy(false);
    }
  };

  const createCat = async () => {
    if (!cat.trim()) return;
    const r = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cat.trim() }),
    });
    const j = await r.json();
    if (!r.ok) {
      alert(j.error || 'Unable to create category.');
      return;
    }
    setCategoryList(cs => [...cs, { ...j.category, productCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
    setCat('');
  };

  const saveCategory = async (id: string) => {
    if (!categoryName.trim()) return;
    const r = await fetch('/api/admin/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: categoryName.trim() }),
    });
    const j = await r.json();
    if (!r.ok) {
      alert(j.error || 'Unable to update category.');
      return;
    }
    setCategoryList(cs => cs.map(c => c.id === id ? { ...c, name: j.category.name, slug: j.category.slug } : c));
    setProducts(ps => ps.map(p => p.categoryId === id ? { ...p, categoryName: j.category.name } : p));
    setEditingCategory(null);
    setCategoryName('');
  };

  const deleteCategory = async (id: string) => {
    const category = categoryList.find(c => c.id === id);
    if (!category) return;

    const r = await fetch('/api/admin/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    const j = await r.json();

    if (r.ok) {
      setCategoryList(cs => cs.filter(c => c.id !== id));
      setPendingCategoryDelete(null);
      setReplacementCategoryId('');
      setProducts(ps => ps.map(p => p.categoryId === id ? { ...p, categoryId: '', categoryName: '' } : p));
      return;
    }

    if (r.status === 409 && j.code === 'CATEGORY_HAS_PRODUCTS') {
      const count = Number(j.productCount) || category.productCount;
      setCategoryList(cs => cs.map(c => c.id === id ? { ...c, productCount: count } : c));
      setPendingCategoryDelete(id);
      setReplacementCategoryId(categoryList.find(c => c.id !== id)?.id || '');
      return;
    }

    alert(j.error || 'Unable to delete category.');
  };

  const performDeleteCategory = async (id: string, replacementId: string) => {
    const category = categoryList.find(c => c.id === id);
    const replacement = categoryList.find(c => c.id === replacementId);
    if (!category || !replacementId) return;

    if (!confirm('Move ' + category.productCount + ' product(s) to "' + replacement?.name + '" and delete "' + category.name + '"?')) return;

    const r = await fetch('/api/admin/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, replacementCategoryId: replacementId }),
    });
    const j = await r.json();
    if (!r.ok) {
      alert(j.error || 'Unable to delete category.');
      return;
    }

    setCategoryList(cs => cs.filter(c => c.id !== id).map(c => c.id === replacementId
      ? { ...c, productCount: c.productCount + (Number(j.reassigned) || 0) }
      : c
    ));
    setProducts(ps => ps.map(p => p.categoryId === id
      ? { ...p, categoryId: replacementId, categoryName: replacement?.name || '' }
      : p
    ));
    setPendingCategoryDelete(null);
    setReplacementCategoryId('');
  };

  const bulk = async (action: 'HIDE' | 'ACTIVATE' | 'DELETE') => {
    if (!selected.length) return;
    const label = action === 'HIDE' ? 'Hide' : action === 'ACTIVATE' ? 'Activate' : 'Delete';
    const prompt = action === 'DELETE'
      ? 'Permanently delete ' + selected.length + ' selected product(s)? Products with order or inventory history will be skipped.'
      : label + ' ' + selected.length + ' selected product(s)?';
    if (!confirm(prompt)) return;

    setBulkBusy(true);
    try {
      const r = await fetch('/api/admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected, action }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Bulk action failed.');

      if (action === 'DELETE') {
        setProducts(ps => ps.filter(p => !(j.deletedIds || []).includes(p.id)));
        setSelected([]);
        if (j.blocked?.length) {
          alert(
            String(j.deletedIds?.length || 0) + ' product(s) deleted. '
            + j.blocked.length
            + ' product(s) could not be permanently deleted because they have order or inventory history; hide them instead.'
          );
        }
        return;
      }

      setProducts(ps => ps.map(p => selected.includes(p.id)
        ? { ...p, status: action === 'HIDE' ? 'HIDDEN' : 'ACTIVE' }
        : p
      ));
      setSelected([]);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Bulk action failed.');
    } finally {
      setBulkBusy(false);
    }
  };

  const archive = async (id: string) => {
    if (!confirm('Hide this product from the storefront?')) return;
    const r = await fetch('/api/admin/products/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'HIDE' }),
    });
    const j = await r.json();
    if (!r.ok) {
      alert(j.error || 'Unable to hide product.');
      return;
    }
    setProducts(ps => ps.map(p => p.id === id ? { ...p, status: 'HIDDEN' } : p));
  };

  const deleteProduct = async (id: string) => {
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (!confirm('Permanently delete "' + p.name + '"? Products with order or inventory history must be hidden instead.')) return;

    const r = await fetch('/api/admin/products/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'DELETE' }),
    });
    const j = await r.json();
    if (!r.ok) {
      alert(j.error || 'Unable to delete product.');
      return;
    }
    setProducts(ps => ps.filter(x => x.id !== id));
    if (editing === id) closeEditor();
  };

  const save = async (id: string) => {
    if (!edit) return;
    setBusy(true);
    try {
      const r = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...edit, id, stock: Number(edit.stock) }),
      });
      const j = await r.json();

      if (r.status === 202) {
        alert(j.message || 'Price change submitted for Super Admin approval.');
        closeEditor();
        return;
      }

      if (!r.ok) throw new Error(j.error || 'Unable to save product.');

      const nextCategoryName = categoryList.find(c => c.id === edit.categoryId)?.name || '';
      const previous = products.find(p => p.id === id);
      setProducts(ps => ps.map(p => p.id === id
        ? {
            ...p,
            ...edit,
            stock: Number(edit.stock),
            categoryName: nextCategoryName,
            sellingPrice: String(edit.sellingPrice),
            sourceCost: edit.sourceCost === '' ? '' : String(edit.sourceCost),
          }
        : p
      ));

      if (previous?.categoryId !== edit.categoryId) {
        setCategoryList(cs => cs.map(c =>
          c.id === previous?.categoryId
            ? { ...c, productCount: Math.max(0, c.productCount - 1) }
            : c.id === edit.categoryId
              ? { ...c, productCount: c.productCount + 1 }
              : c
        ));
      }

      closeEditor();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unable to save product.');
    } finally {
      setBusy(false);
    }
  };

  const upload = async (productId: string, file: File) => {
    setUploading(productId);
    try {
      const fd = new FormData();
      fd.append('productId', productId);
      fd.append('file', file);
      fd.append('altText', alt[productId] || '');
      const r = await fetch('/api/admin/products/images', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Upload failed.');

      setProducts(ps => ps.map(p => p.id === productId
        ? { ...p, images: [...p.images, j.image].sort((a: I, b: I) => a.sortOrder - b.sortOrder) }
        : p
      ));
      setAlt(a => ({ ...a, [productId]: '' }));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(null);
    }
  };

  const remove = async (productId: string, imageId: string) => {
    if (!confirm('Delete this image?')) return;
    const r = await fetch('/api/admin/products/images', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: imageId }),
    });
    const j = await r.json();
    if (!r.ok) {
      alert(j.error || 'Unable to delete image.');
      return;
    }
    setProducts(ps => ps.map(p => p.id === productId
      ? { ...p, images: p.images.filter(i => i.id !== imageId) }
      : p
    ));
  };

  const reorder = async (productId: string, index: number, direction: -1 | 1) => {
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const next = [...p.images];
    const to = index + direction;
    if (to < 0 || to >= next.length) return;

    [next[index], next[to]] = [next[to], next[index]];
    next.forEach((im, i) => { im.sortOrder = i; });

    setProducts(ps => ps.map(x => x.id === productId ? { ...x, images: next } : x));

    const r = await fetch('/api/admin/products/images', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, imageIds: next.map(i => i.id) }),
    });

    if (!r.ok) {
      alert('Unable to save image order. Reload and try again.');
      window.location.reload();
    }
  };

  const toggleVisibleSelection = (checked: boolean) => {
    setSelected(current => {
      if (checked) return Array.from(new Set([...current, ...visibleIds]));
      return current.filter(id => !visibleIds.includes(id));
    });
  };

  const updateEdit = (key: keyof EditState, value: string | boolean) => {
    setEdit(current => current ? { ...current, [key]: value } : current);
  };

  const field = (
    key: keyof Pick<EditState, 'name' | 'slug' | 'metaTitle' | 'canonicalUrl'>,
    label: string,
    mode: InputMode = 'text',
  ) => (
    <input
      value={edit?.[key] ?? ''}
      onChange={e => updateEdit(key, e.target.value)}
      placeholder={label}
      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      inputMode={mode}
    />
  );

  return (
    <div className="mt-8 space-y-6 pb-12">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">Product management</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">Products & categories workspace</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Manage product details, prices, inventory, publishing status, SEO, categories and images from one vertical workflow.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(v => !v)}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800"
          >
            {showCreate ? 'Close create form' : '+ Add product'}
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Total', stats.total, 'All products'],
            ['Active', stats.active, 'Visible / sellable'],
            ['Drafts', stats.drafts, 'Need review'],
            ['Need stock', stats.needsStock, 'Zero-stock items'],
            ['Hidden', stats.hidden, 'Not shown on site'],
          ].map(([label, value, note]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
              <p className="mt-1 text-[11px] text-slate-500">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <MarketplaceImporter categories={categoryList} />

      {showCreate && (
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">Step 1</p>
              <h2 className="mt-1 text-xl font-black">Create a new product</h2>
              <p className="mt-1 text-sm text-slate-500">Create the record first, then the editor opens automatically so you can add images and advanced fields.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Draft-friendly</span>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-black">Basic information</h3>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Product name" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
                <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="Slug (optional; generated when blank)" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Product description" className="min-h-28 rounded-xl border border-slate-200 px-3 py-3 text-sm lg:col-span-2" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-black">Pricing & inventory</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <input value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} placeholder="Selling price ₹" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" inputMode="decimal" />
                <input value={form.sourceCost} onChange={e => setForm({ ...form, sourceCost: e.target.value })} placeholder="Source cost ₹ (private)" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" inputMode="decimal" />
                <input value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="Opening stock" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" inputMode="numeric" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="font-black">Organisation & publishing</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="">No category</option>
                  {categoryList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
                  {statuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} />
                Featured product
              </label>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button disabled={busy} onClick={() => void create()} className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40">
                {busy ? 'Creating…' : 'Create & open editor'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold">
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-600">Organisation</p>
            <h2 className="mt-1 text-xl font-black">Categories</h2>
            <p className="mt-1 text-sm text-slate-500">Keep category assignment consistent. Deletion will ask you where products should move.</p>
          </div>
          <div className="flex w-full gap-2 sm:max-w-md">
            <input value={cat} onChange={e => setCat(e.target.value)} placeholder="New category name" className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-sm" />
            <button onClick={() => void createCat()} className="rounded-xl bg-slate-950 px-4 text-sm font-black text-white">Add</button>
          </div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {categoryList.length ? categoryList.map(c => (
            <div key={c.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {editingCategory === c.id ? (
                <div className="space-y-2">
                  <input value={categoryName} onChange={e => setCategoryName(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => void saveCategory(c.id)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white">Save</button>
                    <button onClick={() => { setEditingCategory(null); setCategoryName(''); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">{c.name}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{c.productCount} product(s) · /{c.slug}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => { setEditingCategory(c.id); setCategoryName(c.name); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold">Edit</button>
                    <button onClick={() => void deleteCategory(c.id)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Delete</button>
                  </div>
                </div>
              )}
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
              No categories yet. Create one above.
            </div>
          )}
        </div>

        {pendingCategoryDelete && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-black text-amber-900">This category still contains products.</p>
            <p className="mt-1 text-xs text-amber-800">Choose a replacement category before deleting it.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select value={replacementCategoryId} onChange={e => setReplacementCategoryId(e.target.value)} className="h-10 min-w-0 flex-1 rounded-xl border border-amber-200 bg-white px-3 text-sm">
                <option value="">Choose replacement category</option>
                {categoryList.filter(c => c.id !== pendingCategoryDelete).map(c => <option key={c.id} value={c.id}>{c.name} ({c.productCount})</option>)}
              </select>
              <button disabled={!replacementCategoryId} onClick={() => void performDeleteCategory(pendingCategoryDelete, replacementCategoryId)} className="rounded-xl bg-amber-700 px-4 py-2 text-xs font-black text-white disabled:opacity-40">
                Move & delete
              </button>
              <button onClick={() => { setPendingCategoryDelete(null); setReplacementCategoryId(''); }} className="rounded-xl border border-amber-200 bg-white px-4 py-2 text-xs font-bold">Cancel</button>
            </div>
          </div>
        )}
      </section>

      {editingProduct && edit && (
        <section className="rounded-3xl border-2 border-indigo-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600">Product editor</p>
              <h2 className="mt-1 text-2xl font-black">Edit {editingProduct.name}</h2>
              <p className="mt-1 text-sm text-slate-500">Work through each card from top to bottom, then save once.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold">{edit.status}</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">{editingProduct.images.length} image(s)</span>
              <button onClick={closeEditor} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">Close editor</button>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">01 · Basic</p>
                  <h3 className="mt-1 text-lg font-black">Product information</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{edit.name.length}/200</span>
              </div>
              <div className="mt-4 space-y-3">
                {field('name', 'Product name')}
                {field('slug', 'URL slug')}
                <textarea value={edit.description} onChange={e => updateEdit('description', e.target.value)} placeholder="Full product description" className="min-h-36 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">02 · Commercial</p>
                  <h3 className="mt-1 text-lg font-black">Pricing & inventory</h3>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Estimated margin</p>
                  <p className={(editMargin >= 0 ? 'text-emerald-600' : 'text-red-600') + ' text-sm font-black'}>{editMargin.toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <input value={edit.sellingPrice} onChange={e => updateEdit('sellingPrice', e.target.value)} placeholder="Selling price ₹" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" inputMode="decimal" />
                <input value={edit.sourceCost} onChange={e => updateEdit('sourceCost', e.target.value)} placeholder="Source cost ₹ (private)" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" inputMode="decimal" />
                <input value={edit.stock} onChange={e => updateEdit('stock', e.target.value)} placeholder="Stock" className="h-11 rounded-xl border border-slate-200 px-3 text-sm" inputMode="numeric" />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Selling price</p><p className="font-black">{money(edit.sellingPrice)}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Source cost</p><p className="font-black">{edit.sourceCost ? money(edit.sourceCost) : '—'}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] text-slate-400">Gross difference</p><p className="font-black">{money(editProfit)}</p></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">03 · Organisation</p>
              <h3 className="mt-1 text-lg font-black">Category & storefront status</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select value={edit.categoryId} onChange={e => updateEdit('categoryId', e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
                  <option value="">No category</option>
                  {categoryList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={edit.status} onChange={e => updateEdit('status', e.target.value as Status)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
                  {statuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={edit.featured} onChange={e => updateEdit('featured', e.target.checked)} />
                Featured product
              </label>
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                Active products must have stock greater than zero. Saving an active product with zero stock will be rejected by the server.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">04 · SEO</p>
              <h3 className="mt-1 text-lg font-black">Search metadata</h3>
              <div className="mt-4 space-y-3">
                {field('metaTitle', 'SEO meta title')}
                <textarea value={edit.metaDescription} onChange={e => updateEdit('metaDescription', e.target.value)} placeholder="SEO meta description" className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                {field('canonicalUrl', 'Canonical URL', 'url')}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Meta title: <span className="font-bold text-slate-700">{edit.metaTitle.length}/160</span></div>
                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Meta description: <span className="font-bold text-slate-700">{edit.metaDescription.length}/320</span></div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-indigo-600">05 · Media</p>
                  <h3 className="mt-1 text-lg font-black">Product images</h3>
                  <p className="mt-1 text-xs text-slate-500">Images from marketplace imports use Zenvora image delivery path. Broken images can be removed and re-uploaded here.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black">{editingProduct.images.length} stored</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {editingProduct.images.map((im, index) => (
                  <div key={im.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="aspect-square">
                      <ImageTile src={productImage(im.url)} alt={im.altText || editingProduct.name} label={index === 0 ? 'Primary' : 'Image ' + (index + 1)} compact />
                    </div>
                    <div className="p-2">
                      <p className="truncate text-[10px] font-bold text-slate-600" title={im.altText || editingProduct.name}>{im.altText || editingProduct.name}</p>
                      <div className="mt-2 grid grid-cols-3 gap-1">
                        <button disabled={index === 0} onClick={() => void reorder(editingProduct.id, index, -1)} className="rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-black disabled:opacity-30">←</button>
                        <button disabled={index === editingProduct.images.length - 1} onClick={() => void reorder(editingProduct.id, index, 1)} className="rounded-lg border border-slate-200 bg-white py-1.5 text-xs font-black disabled:opacity-30">→</button>
                        <button onClick={() => void remove(editingProduct.id, im.id)} className="rounded-lg border border-red-200 bg-red-50 py-1.5 text-xs font-black text-red-700">×</button>
                      </div>
                    </div>
                  </div>
                ))}

                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-slate-400 hover:bg-white">
                  <span className="text-3xl font-light text-slate-400">+</span>
                  <span className="mt-1 text-xs font-black text-slate-600">{uploading === editingProduct.id ? 'Uploading…' : 'Add image'}</span>
                  <span className="mt-1 text-[9px] text-slate-400">JPG · PNG · WebP · 5 MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading === editingProduct.id}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) void upload(editingProduct.id, file);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <label className="text-[10px] font-black uppercase tracking-wide text-slate-500">Alt text for next upload</label>
                <input value={alt[editingProduct.id] || ''} onChange={e => setAlt(a => ({ ...a, [editingProduct.id]: e.target.value }))} placeholder="Describe the product image" maxLength={160} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" />
              </div>
            </div>

            <div className="sticky bottom-3 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-slate-500">Review Basic → Commercial → Organisation → SEO → Media before saving.</p>
                <div className="flex gap-2">
                  <button onClick={closeEditor} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black">Cancel</button>
                  <button disabled={busy} onClick={() => void save(editingProduct.id)} className="rounded-xl bg-slate-950 px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">
                    {busy ? 'Saving…' : 'Save all changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600">Catalogue</p>
            <h2 className="mt-1 text-xl font-black">Product library</h2>
            <p className="mt-1 text-sm text-slate-500">{filteredProducts.length} of {products.length} products shown.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
              <input type="checkbox" checked={allVisibleSelected} onChange={e => toggleVisibleSelection(e.target.checked)} />
              Select visible
            </label>
            <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{selectedCount} selected</span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, slug or category…"
            className="h-11 rounded-xl border border-slate-200 px-3 text-sm xl:col-span-2"
            inputMode="search"
          />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
            <option value="ALL">All statuses</option>
            {statuses.map(s => <option key={s}>{s}</option>)}
          </select>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm">
            <option value="ALL">All categories</option>
            {categoryList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-bold">
            <option value="newest">Newest</option>
            <option value="name">Name A–Z</option>
            <option value="price-high">Price high → low</option>
            <option value="stock-low">Stock low → high</option>
          </select>
          <button disabled={!selected.length || bulkBusy} onClick={() => void bulk('HIDE')} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-black disabled:opacity-40">Hide selected</button>
          <button disabled={!selected.length || bulkBusy} onClick={() => void bulk('ACTIVATE')} className="h-10 rounded-xl bg-slate-950 px-3 text-xs font-black text-white disabled:opacity-40">Activate selected</button>
          <button disabled={!selected.length || bulkBusy} onClick={() => void bulk('DELETE')} className="h-10 rounded-xl border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 disabled:opacity-40">Delete selected</button>
        </div>

        <div className="mt-5 space-y-3">
          {filteredProducts.length ? filteredProducts.map(p => (
            <article key={p.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-4 p-4 sm:flex-row">
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  <ImageTile src={productImage(p.images[0]?.url)} alt={p.images[0]?.altText || p.name} label={p.images.length ? 'Primary' : undefined} compact />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-400">
                        <input type="checkbox" checked={selected.includes(p.id)} onChange={e => setSelected(s => e.target.checked ? Array.from(new Set([...s, p.id])) : s.filter(id => id !== p.id))} />
                        Select
                      </label>
                      <h3 className="mt-1 break-words text-lg font-black text-slate-950">{p.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{p.categoryName || 'Uncategorized'} · {p.status} · {p.images.length} image(s)</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-lg font-black text-slate-950">{money(p.sellingPrice)}</p>
                      <p className={p.stock > 0 ? 'text-xs font-bold text-emerald-600' : 'text-xs font-bold text-amber-700'}>Stock: {p.stock}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[9px] font-black uppercase text-slate-400">Source cost</p><p className="text-xs font-black">{p.sourceCost ? money(p.sourceCost) : '—'}</p></div>
                    <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[9px] font-black uppercase text-slate-400">Slug</p><p className="truncate text-xs font-bold text-slate-600">{p.slug}</p></div>
                    <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[9px] font-black uppercase text-slate-400">Featured</p><p className="text-xs font-black">{p.featured ? 'Yes' : 'No'}</p></div>
                    <div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[9px] font-black uppercase text-slate-400">Media</p><p className="text-xs font-black">{p.images.length} image(s)</p></div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => begin(p)} className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-black text-white">Edit product</button>
                    <button onClick={() => void archive(p.id)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black">Hide</button>
                    <button onClick={() => void deleteProduct(p.id)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-black text-red-700">Delete</button>
                    {p.featured && <span className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700">Featured</span>}
                    {p.stock <= 0 && <span className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">Needs stock</span>}
                  </div>
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center">
              <p className="font-black text-slate-700">No products match these filters.</p>
              <button onClick={() => { setSearch(''); setFilterStatus('ALL'); setFilterCategory('ALL'); }} className="mt-2 text-xs font-black text-indigo-600">Clear filters</button>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-[11px] text-slate-500">
          Product images are loaded through the Zenvora image delivery path when they are private Blob files or supported marketplace source images. Uploading a fresh image from the editor gives you a stable private Blob copy.
        </div>
      </section>
    </div>
  );
}
