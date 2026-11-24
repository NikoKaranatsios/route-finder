(function mapScript(){
'use strict';
const svg=document.getElementById('walkMap'),D=TRIP.dest;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seaNames=[['Andaman Sea',95,10.5],['Gulf of Thailand',101.65,10.5],['South China Sea',113,14],['East China Sea',125,28],['Philippine Sea',136,22],['Sea of Japan',134,41],['Bay of Bengal',91.3,15.8]];
const countryNames=[['THAILAND',100.3,16],['VIETNAM',108.3,13.3],['MYANMAR',96.7,20.9],['LAOS',103.8,19.8],['CAMBODIA',104.6,12.8],['CHINA',112,31],['MALAYSIA',102,4.9],['JAPAN',139.8,37.5],['SOUTH KOREA',127.6,36.3],['TAIWAN',120.9,23.7],['PHILIPPINES',122.5,13.5]];
const colors={THA:'#dce4cd',VNM:'#d7e0c8',JPN:'#dde4d0',KOR:'#d8e0c9'};
const land=LAND.map(([id,n,path])=>`<path d="${path}" fill="${colors[id]||'#e9e9dd'}" stroke="#a4b6a6" stroke-width=".8" vector-effect="non-scaling-stroke"/>`).join('');
let info=null,center=[101,15],span=22,key='',anim=0,drag=null,moved=false,clickFn;
function coordinate(url){try{const u=new URL(url);const query=u.searchParams.get('query')||u.searchParams.get('q')||'';const v=query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);return v?[+v[2],+v[1]]:null;}catch{return null;}}
function point(id){return [D[id].lon,D[id].lat];}
function zoomTo(coords,newSpan,smooth=true){
 cancelAnimationFrame(anim);const old=[...center],oldS=span;
 if(!smooth||matchMedia('(prefers-reduced-motion: reduce)').matches){center=coords;span=newSpan;draw();return;}
 const start=performance.now();function frame(now){const t=Math.min(1,(now-start)/220),k=1-(1-t)**3;center=[old[0]+(coords[0]-old[0])*k,old[1]+(coords[1]-old[1])*k];span=oldS+(newSpan-oldS)*k;draw();if(t<1)anim=requestAnimationFrame(frame);}anim=requestAnimationFrame(frame);
}
function fit(smooth=false){if(!info||!svg.parentElement.clientWidth)return;
 const {stops,options,mode,active,pois}=info;let pts=[];
 if(mode==='area'){pts=[point(active),...pois.map(o=>o.xy)];}
 else if(mode==='all'){pts=[...stops.map(s=>point(s.id)),...options.map(point)];}
 else {pts=[point(stops.at(-1).id),...options.map(point)];if(active)pts.push(point(active));}
 const xs=pts.map(a=>a[0]),ys=pts.map(a=>a[1]);
 const dx=Math.max(...xs)-Math.min(...xs),dy=Math.max(...ys)-Math.min(...ys),w=svg.parentElement.clientWidth,h=svg.parentElement.clientHeight;
 const factor=mode==='area'?1.4:1.46;const aspect=w/Math.max(80,h-95);
 const minSpan=mode==='area'?.045:7;
 zoomTo([(Math.max(...xs)+Math.min(...xs))/2,(Math.max(...ys)+Math.min(...ys))/2],Math.min(95,Math.max(minSpan,dx*factor,dy*aspect*factor/.9)),smooth);
}
function draw(){if(!info||!svg.parentElement.clientWidth)return;
 const {stops,options,active,mode,pois,focus}=info,w=svg.parentElement.clientWidth,h=svg.parentElement.clientHeight,s=w/span,sy=s/.9,x=a=>w/2+(a-center[0])*s,y=b=>h/2-(b-center[1])*sy;
 svg.classList.toggle('local-area',mode==='area');
 svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const base=svg.querySelector('#wkbase');if(!base){svg.innerHTML=`<defs><pattern id="wkgrain" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".56" fill="#95b6b1" opacity=".28"/></pattern></defs><rect width="100%" height="100%" fill="#d6e7e3"/><rect width="100%" height="100%" fill="url(#wkgrain)"/><g id="wkbase">${land}</g><g id="wkoverlay"></g>`;}
 svg.querySelector('#wkbase').setAttribute('transform',`translate(${x(0)} ${y(0)}) scale(${s} ${sy})`);
 let content='';const step=span>40?10:span>9?3:span>2?1:span>.3?.1:.02;const l0=Math.floor((center[0]-span/2)/step)*step,b0=Math.floor((center[1]-h/(2*sy))/step)*step;let lines='';
 for(let a=l0;a<center[0]+span/2;a+=step)lines+=`M${x(a)} 0V${h}`;for(let b=b0;b<center[1]+h/(2*sy);b+=step)lines+=`M0 ${y(b)}H${w}`;content+=`<path d="${lines}" stroke="#96aaa0" opacity=".35" stroke-width=".6" fill="none" stroke-dasharray="2 4"/>`;
 if(mode!=='area'){for(const [n,lon,lat] of countryNames)content+=`<text class="countrylabel" x="${x(lon)}" y="${y(lat)}">${n}</text>`;for(const [n,lon,lat] of seaNames)content+=`<text class="sealabel" x="${x(lon)}" y="${y(lat)}">${n}</text>`;}
 function curve(a,b,cls){const [ax,ay]=point(a),[bx,by]=point(b);const dx=x(bx)-x(ax),dy=y(by)-y(ay);return `<path class="${cls}" d="M${x(ax)} ${y(ay)}q${dx*.5+dy*.09} ${dy*.5-dx*.09} ${dx} ${dy}"/>`;}
 if(mode!=='area'){for(let i=1;i<stops.length;i++)content+=curve(stops[i-1].id,stops[i].id,'wkline');for(const id of options)content+=curve(stops.at(-1).id,id,id===active?'wkoption wkactive':'wkoption');}
 const visible=mode==='area'?[active]:[...new Set([...stops.map(o=>o.id),...options])];const occupied=[];
 for(const id of visible.sort((a,b)=>Number(a===active)-Number(b===active))){
  const d=D[id],px=x(d.lon),py=y(d.lat),num=stops.map(a=>a.id).lastIndexOf(id)+1,selected=id===active,current=id===stops.at(-1).id;
  if(px<-40||px>w+40||py<0||py>h)continue;
  const name=d.name;let tx=px+16,ty=py+4;const size=name.length*7.7+16;
  if(tx+size>w-12)tx=px-size-12;while(occupied.some(([x0,y0,x1,y1])=>tx<x1&&tx+size>x0&&ty>y0&&ty-16<y1))ty-=20;
  occupied.push([tx-2,ty-16,tx+size,ty+3]);const key=options.includes(id)&&(!num||!current)?'next':'stay';
  content+=`<g role="button" tabindex="0" class="wkpin ${num?'placed':'prospect'} ${selected?'chosen':''}" data-destination="${id}" data-role="${key}" aria-label="${safe(name+' · '+(num?'planned stay':'possible next stop'))}"><title>${safe(name)}</title><circle class="hitzone" cx="${px}" cy="${py}" r="18"/><circle class="halo" cx="${px}" cy="${py}" r="${selected||current?15:11}"/><circle class="pinbody" cx="${px}" cy="${py}" r="${num?10:7}"/>${num?`<text x="${px}" y="${py+3.7}" class="pinnumber">${num}</text>`:''}<text x="${tx}" y="${ty}" class="pinlabel">${safe(name)}</text></g>`;
 }
 if(mode==='area'){for(const o of [...pois].sort((a,b)=>Number(a.id===focus)-Number(b.id===focus))){const px=x(o.xy[0]),py=y(o.xy[1]),on=o.id===focus;content+=`<g role="button" tabindex="0" data-place="${safe(o.id)}" class="wkpoi${on?' chosen':''}" aria-label="${safe(o.name)}"><title>${safe(o.name)}</title><circle class="hitzone" cx="${px}" cy="${py}" r="10"/><circle class="poi-dot" cx="${px}" cy="${py}" r="${on?7:4}"/>${on?`<text class="pinlabel" x="${Math.min(w-180,px+10)}" y="${py-10}">${safe(o.name.slice(0,32))}</text>`:''}</g>`;}}
 svg.querySelector('#wkoverlay').innerHTML=content;
}
function set(infoNew,callback){const previous=key;info=infoNew;clickFn=callback;key=JSON.stringify([info.stops.map(s=>s.id),info.options,info.mode,info.mode==='area'?info.active:null,info.mode==='area'?info.pois.map(z=>z.id):null]);if(previous!==key)fit(!!previous);else draw();}
function trigger(target){const hit=target.closest('[data-destination],[data-place]');if(!hit)return;clickFn(hit.dataset.destination||hit.dataset.place,hit.dataset.place?'place':hit.dataset.role);}
svg.addEventListener('click',e=>{if(moved){moved=false;return;}trigger(e.target);});
svg.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target!==svg){e.preventDefault();trigger(e.target);}else if(['+','-'].includes(e.key))zoom(e.key==='+'?.68:1.45);else if(e.key.startsWith('Arrow')){const dir={ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[e.key];if(dir){e.preventDefault();zoomTo(center.map((n,i)=>n+dir[i]*span*.1),span);}}});
function zoom(f){zoomTo([...center],Math.min(100,Math.max(.014,span*f)));}
svg.addEventListener('pointerdown',e=>{cancelAnimationFrame(anim);drag={x:e.clientX,y:e.clientY,center:[...center]};moved=false;});
svg.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!moved&&Math.hypot(dx,dy)<5)return;moved=true;svg.setPointerCapture(e.pointerId);center=[Math.max(85,Math.min(151,drag.center[0]-dx*span/svg.parentElement.clientWidth)),Math.max(-3,Math.min(50,drag.center[1]+dy*.9*span/svg.parentElement.clientWidth))];draw();});
window.addEventListener('pointerup',()=>drag=null);svg.addEventListener('pointercancel',()=>drag=null);new ResizeObserver(()=>fit(false)).observe(svg);
function hover(id,on){svg.querySelectorAll('[data-destination]').forEach(el=>{if(el.dataset.destination===id)el.classList.toggle('hovered',on);});}
globalThis.WalkMap={coordinate,set,fit,zoom,hover};
})();
