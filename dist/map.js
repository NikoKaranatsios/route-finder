(function mapModule(){
'use strict';
const svg=document.getElementById('map');
const palette={'Thailand':'#397461','Vietnam':'#b55f3a','Japan':'#606ba1','South Korea':'#966684'};
const inks={THA:'#c0d3b8',VNM:'#e2c8a8',JPN:'#cbcddd',KOR:'#dac6d1'};
const countries={'China':[112,32],'Myanmar':[96,22],'Thailand':[100.4,16.4],'Vietnam':[108.2,17.8],'Laos':[103,21.2],'Cambodia':[104.5,12.3],'Japan':[139.7,38.3],'South Korea':[128.8,35.7],'Malaysia':[101,4],'Philippines':[123.3,13.4],'Taiwan':[121.5,24.7],'Mongolia':[104,46]};
const seas=[['South China Sea',114,13.0],['East China Sea',124.1,27.0],['Philippine Sea',137,20.8],['Bay of Bengal',89.5,13.5],['Sea of Japan',133,40]];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let view={center:[119.6,23.2],span:53},region='All',data=null,sel=-1,fn,drag=null,moved=false;
function bounds(ids){
 const ds=ids.map(k=>TRIP.dest[k]); if(!ds.length)return;
 const lon=ds.map(d=>d.lon),lat=ds.map(d=>d.lat);
 const w=svg.clientWidth||600,h=svg.clientHeight||400;
 const dx=Math.max(...lon)-Math.min(...lon),dy=Math.max(...lat)-Math.min(...lat);
 const pad=region==='All'?1.17:1.6;
 view={center:[(Math.max(...lon)+Math.min(...lon))/2,(Math.max(...lat)+Math.min(...lat))/2],span:Math.min(120,Math.max(3,dx*pad,dy*w/h/0.88*pad))};
}
function project(){
 const w=svg.clientWidth||600,h=svg.clientHeight||400,s=w/view.span,sy=s/.88;
 return {w,h,s,sy,x:lon=>w/2+(lon-view.center[0])*s,y:lat=>h/2-(lat-view.center[1])*sy};
}
function draw(){
 if(!data||!svg.clientWidth)return;
 const {w,h,s,sy,x,y}=project();
 svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const land=LAND.map(([iso,n,path])=>`<path d="${path}" fill="${inks[iso]||'#e6e8d9'}" vector-effect="non-scaling-stroke" stroke="#b2bda9" stroke-width=".8"/>`).join('');
 let grid='';const step=view.span<15?2:10;
 for(let a=80;a<162;a+=step)grid+=`<path d="M${x(a)} 0V${h}"/>`;
 for(let b=-10;b<60;b+=step)grid+=`<path d="M0 ${y(b)}H${w}"/>`;
 let labels='';for(const [n,[lon,lat]] of Object.entries(countries))labels+=`<text x="${x(lon)}" y="${y(lat)}" fill="#718276" font-size="${region==='All'?9:11}" letter-spacing="1.8" text-anchor="middle">${esc(n.toUpperCase())}</text>`;
 for(const [n,lon,lat] of seas)labels+=`<text x="${x(lon)}" y="${y(lat)}" fill="#6c9394" font-style="italic" font-family="Georgia,serif" font-size="13" letter-spacing="1" text-anchor="middle">${n}</text>`;
 let path='',markers='';const visited=new Set(data.map(z=>z.id));
 const pts=data.map(z=>{const d=TRIP.dest[z.id];return [x(d.lon),y(d.lat)];});
 for(let i=1;i<pts.length;i++){const [ax,ay]=pts[i-1],[bx,by]=pts[i],dx=bx-ax,dy=by-ay;const bend=Math.min(30,Math.hypot(dx,dy)*.13);const len=Math.hypot(dx,dy)||1;const mx=(ax+bx)/2+dy/len*bend,my=(ay+by)/2-dx/len*bend;
 const line=`M${ax} ${ay}Q${mx} ${my} ${bx} ${by}`;const known=TRIP.legs[data[i-1].id+'-'+data[i].id];path+=`<path d="${line}" fill="none" stroke="#fcfcf1" stroke-width="4" opacity=".83"/><path d="${line}" fill="none" stroke="${known?'#2e6457':'#a04d39'}" stroke-width="1.9" ${TRIP.dest[data[i].id].country!==TRIP.dest[data[i-1].id].country||!known?'stroke-dasharray="5 4"':''}/>`;}
 const shown=[];const hits=(a,b)=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1];
 const points=[];const target=new Map();data.forEach((z,i)=>{if(!target.has(z.id)||i===sel)target.set(z.id,i)});
 for(const [id,d] of Object.entries(TRIP.dest)){const i=target.get(id)??-1;const px=x(d.lon),py=y(d.lat);
 if(px<-20||py<-18||px>w+20||py>h+18)continue;
 points.push({id,d,i,px,py});}
 // Keep adjacent stops individually selectable, with a leader to their true position.
 const occupied=[];for(const p of points.filter(p=>p.i>=0).sort((a,b)=>a.i-b.i)){
 let {px,py}=p;const shifts=[[0,0],[14,-15],[-14,15],[21,5],[-21,-5],[0,26],[0,-26]];
 for(const [dx,dy] of shifts){if(!occupied.some(([a,b])=>Math.hypot(px+dx-a,py+dy-b)<22)){p.dx=dx;p.dy=dy;break;}}
 p.dx??=0;p.dy??=0;occupied.push([px+p.dx,py+p.dy]);shown.push([px+p.dx-9,py+p.dy-9,px+p.dx+9,py+p.dy+9]);}
 for(const p of points.sort((a,b)=>(a.i>=0)-(b.i>=0))){const {id,d,i}=p;let px=p.px+(p.dx||0),py=p.py+(p.dy||0);const color=palette[d.country];const num=i+1;
 if(p.dx||p.dy)markers+=`<line x1="${p.px}" y1="${p.py}" x2="${px}" y2="${py}" stroke="${color}" stroke-width="1.2"/>`;
 markers+=`<g class="mapnode" data-mapid="${id}" role="button" tabindex="0" aria-label="${esc(d.name+(i>=0?' stop '+num:' destination'))}" style="cursor:pointer"><title>${esc(d.name+(i>=0?' · '+data[i].n+' nights':' · Explore destination'))}</title><circle cx="${px}" cy="${py}" r="${i>=0?14:8}" fill="transparent"/>${i===sel&&i>=0?`<circle cx="${px}" cy="${py}" r="13" fill="none" stroke="${color}" stroke-width="1.3"/>`:''}<circle cx="${px}" cy="${py}" r="${i>=0?9:3.4}" fill="${i>=0?color:'#fffdf6'}" stroke="${i>=0?'#fffdf2':color}" stroke-width="${i>=0?1.6:1.2}"/>${i>=0?`<text x="${px}" y="${py+3.3}" fill="white" text-anchor="middle" font-size="9.5" font-weight="bold">${num}</text>`:''}</g>`;
 }
 const priority=points.filter(p=>p.i>=0).sort((a,b)=>Number(b.i===sel)-Number(a.i===sel)||a.i-b.i);
 for(const p of priority){const px=p.px+(p.dx||0),py=p.py+(p.dy||0),width=p.d.name.length*6.2+2;for(const [offsetX,offsetY] of [[13,3],[-width-13,4],[10,-13],[-width-10,16],[7,21]]){
 const lx=px+offsetX,ly=py+offsetY,box=[lx-2,ly-10,lx+width+2,ly+3];if(lx<3||lx+width>w-2||ly<13||ly>h-10||shown.some(b=>hits(box,b)))continue;
 markers+=`<text class="siteMapLabel" x="${lx}" y="${ly}" fill="#203e36" font-size="11.5" font-weight="650" pointer-events="none">${esc(p.d.name)}</text>`;shown.push(box);break;}}
 svg.innerHTML=`<defs><pattern id="seaDots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill="#accac7" opacity=".55"/></pattern></defs><rect width="${w}" height="${h}" fill="#d8e9e8"/><rect width="${w}" height="${h}" fill="url(#seaDots)"/><g transform="translate(${x(0)} ${y(0)}) scale(${s} ${sy})">${land}</g><g stroke="#95aaa0" stroke-width=".55" opacity=".28" stroke-dasharray="2 4">${grid}</g><g pointer-events="none">${labels}${path}</g>${markers}`;
}
function fit(newRegion='All'){region=newRegion;const ids=Object.keys(TRIP.dest).filter(id=>newRegion==='All'?data?.some(z=>z.id===id):TRIP.dest[id].country===newRegion);bounds(ids);draw();}
function zoom(f){view.span=Math.min(115,Math.max(.45,view.span*f));draw();}
svg.addEventListener('click',e=>{if(moved){moved=false;return;}const k=e.target.closest('[data-mapid]')?.dataset.mapid;if(k)fn(k);});
svg.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const k=e.target.closest('[data-mapid]')?.dataset.mapid;if(k){e.preventDefault();fn(k);}}else if(e.key==='+')zoom(.7);else if(e.key==='-')zoom(1.4);else if(e.key.startsWith('Arrow')){const v=view.span/10;const dir={ArrowUp:[0,v],ArrowDown:[0,-v],ArrowLeft:[-v,0],ArrowRight:[v,0]}[e.key];if(dir){e.preventDefault();view.center=view.center.map((n,i)=>n+dir[i]);draw();}}});
svg.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,center:[...view.center]};moved=false;});
svg.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!moved&&Math.hypot(dx,dy)<5)return;moved=true;try{svg.setPointerCapture(e.pointerId);}catch{}const {s,sy}=project();view.center=[Math.max(85,Math.min(152,drag.center[0]-dx/s)),Math.max(-2,Math.min(50,drag.center[1]+dy/sy))];draw();});
window.addEventListener('pointerup',()=>drag=null);svg.addEventListener('pointercancel',()=>drag=null);
new ResizeObserver(()=>{if(data&&svg.clientWidth)fit(region);}).observe(svg);
globalThis.AtlasMap={palette,render(stops,selected,callback){const first=!data;data=stops;sel=selected;fn=callback;if(first)fit();else draw();},fit,zoom};
})();
