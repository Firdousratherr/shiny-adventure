'use client';

import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useCart } from './cart-provider';

export default function AddToCart({product}:{product:{id:string;name:string;slug?:string;price:number;image?:string;stock:number}}){
  const {add}=useCart();
  const [quantity,setQuantity]=useState(1);
  const [added,setAdded]=useState(false);
  useEffect(()=>{if(!added)return;const t=window.setTimeout(()=>setAdded(false),2600);return()=>window.clearTimeout(t)},[added]);
  if(product.stock<1)return <button disabled className="store-add-btn is-disabled">Out of stock</button>;
  return <div className="store-add-wrap"><div className="flex items-center justify-between gap-3"><div className="store-quantity"><button type="button" onClick={()=>setQuantity(q=>Math.max(1,q-1))} aria-label="Decrease quantity">−</button><span>{quantity}</span><button type="button" onClick={()=>setQuantity(q=>Math.min(product.stock,q+1))} aria-label="Increase quantity">+</button></div><span className="text-xs font-bold text-slate-400">{product.stock} available</span></div>{added?<div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><div className="store-add-success"><span>✓</span> Added to cart</div><Link href="/cart" className="store-view-cart-btn">View cart</Link></div>:<button type="button" onClick={()=>{add({productId:product.id,name:product.name,slug:product.slug,image:product.image,price:product.price,quantity,stock:product.stock});setAdded(true)}} className="store-add-btn mt-3">Add to cart <span>→</span></button>}</div>;
}
