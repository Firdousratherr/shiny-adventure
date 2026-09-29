'use client';

import { useState } from 'react';
type ImageItem={url:string;alt:string};

export default function ProductGallery({images,name,stock}:{images:ImageItem[];name:string;stock:number}){
  const [active,setActive]=useState(0);
  const [zoom,setZoom]=useState(false);
  const current=images[active];
  if(!images.length)return <div className="store-gallery-empty">Z</div>;
  return <>
    <div className="store-gallery">
      <button type="button" onClick={()=>setZoom(true)} className="store-gallery-main" aria-label="Open product image larger">
        <div className="store-gallery-glow" aria-hidden="true" />
        <img src={current.url} alt={current.alt} loading="eager" decoding="async" />
        <span className="store-gallery-hint">Click to enlarge ↗</span>
        {stock>0&&stock<=5&&<span className="store-warn-badge absolute left-4 top-4">Only {stock} left</span>}
      </button>
    </div>
    {images.length>1&&<div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6" role="list" aria-label="Product images">{images.slice(0,6).map((image,index)=><button key={image.url+index} type="button" onClick={()=>setActive(index)} aria-label={'Show image '+(index+1)} aria-current={index===active} className={'store-gallery-thumb '+(index===active?'is-active':'')}><img src={image.url} alt="" loading="lazy" decoding="async" /></button>)}</div>}
    {zoom&&<div className="store-lightbox" role="dialog" aria-modal="true" aria-label={'Larger image of '+name} onClick={()=>setZoom(false)}><button type="button" onClick={()=>setZoom(false)} className="store-lightbox-close" aria-label="Close image">×</button><img src={current.url} alt={current.alt} onClick={e=>e.stopPropagation()} /></div>}
  </>;
}
