(function(){
'use strict';
const G=StepGraph,M=AtlasModel,D=TRIP.dest,H=TRIP.hotels,R=TRIP.rules;
const $=id=>document.getElementById(id),copy=M.clone;
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-IE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const day=n=>new Date(M.iso(n)+'T00:00:00Z').toLocaleDateString('en-GB',{month:'short',day:'numeric',timeZone:'UTC'});
const btn=(a,label,attrs='',cls='wbutton')=>`<button type="button" class="${cls}" data-w="${a}" ${attrs}>${e(label)}</button>`;
const link=(url,name)=>/^https?:\/\//i.test(url??'')?`<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(name)}</a>`:'';
const tiny=s=>`<span class="micro">${e(s)}</span>`, meta=(...ss)=>ss.filter(Boolean).map(e).join(' · ');
const modeText=l=>l.mode.replaceAll('Flug','Flight').replaceAll('Fähre','Ferry').replaceAll('Bahn','Rail').replaceAll('mit Umstieg','with connection').replace(' via Osaka',' via Osaka');
const title=(k,t)=>`<header class="subhead">${tiny(k)}<h2>${e(t)}</h2></header>`;
const key='honeymoon-atlas.steps.v2',categories=['Activities','Restaurants','Sights','Shopping'];
const cats={Activities:'Activities',Restaurants:'Restaurants',Sights:'Attractions',Shopping:'Shops'};
let api,p,steps,weights,saved=[],undo=[],options=[],cache='',view='next',detail=null,back='next',storageOK=true;
const validWeights=w=>Array.isArray(w)&&w.length===6&&w.every(n=>Number.isFinite(n)&&n>=0&&n<=100)&&w.some(n=>n>0);
function validFile(o){try{return o?.kind==='honeymoon-atlas-steps'&&o.version===2&&G.validStops(o.steps)&&validWeights(o.weights)&&api.validatePrefs(o.p);}catch{return false;}}
function init(){
 weights=[...G.defaultWeights];steps=[G.first(p,weights)];
 try{const raw=JSON.parse(localStorage.getItem(key)||'null');if(raw){if(validFile(raw)){steps=raw.steps;weights=raw.weights;}saved=Array.isArray(raw.saved)?raw.saved.filter(o=>validFile(o)&&typeof o.name==='string'):[];}}catch{storageOK=false;}
}
function payload(){return {kind:'honeymoon-atlas-steps',version:2,steps:copy(steps),weights:[...weights],p:copy(p)};}
function storeDraft(){try{localStorage.setItem(key,JSON.stringify({...payload(),saved}));storageOK=true;}catch{storageOK=false;api.notify('Browser storage is unavailable. Export your route to keep a copy.');}}
function mark(){undo.push(payload());if(undo.length>25)undo.shift();}
function restore(o){steps=copy(o.steps);weights=[...o.weights];p=copy(o.p);api.applyPrefs(p);cache='';}
function show(v){detail=null;view=v;paint(true);}
function refresh(){const sig=JSON.stringify([steps,p,weights]);if(sig!==cache){cache=sig;options=G.options(steps,p,weights);}}
function selection(s,i){back=view==='detail'?back:view;view='detail';detail={s:copy(s),i,tab:'Overview',category:'Activities',search:'',limit:10,sort:'fit',focus:'',shapes:i===steps.length?options.find(x=>x.s.id===s.id)?.shapes:[]};paint(true);}
function prefix(){return steps.slice(0,detail.i);}
function proposed(){const draft=copy(steps),s=copy(detail.s);if(detail.i===draft.length)draft.push(s);else{const diff=s.n-draft[detail.i].n;draft[detail.i]=s;if(draft.at(-1).id==='SEL'&&detail.i<draft.length-1)draft.at(-1).n-=diff;}return draft;}
function problem(){
 const s=detail.s,draft=proposed(),n=G.nights(draft);
 if(!Number.isInteger(s.n)||s.n<1||s.n>G.days)return 'Choose a whole number of nights from 1 to 80.';
 if(s.id==='TYO'&&p.tokyo&&s.n>p.tokyo)return `Your Tokyo limit is ${p.tokyo} nights.`;
 if(n>G.days||n===G.days&&draft.at(-1).id!=='SEL')return 'Leave time to reach Seoul before 31 March.';
 if(draft.at(-1).id==='SEL'&&(n!==G.days||draft.at(-1).n<R.seoul))return `Keep at least ${R.seoul} nights in Seoul and depart on 31 March.`;
 if(!G.validStops(draft))return 'This change does not fit the trip dates or transfers.';
 return '';
}
function places(){const d=detail;return G.byBase[d.s.id].filter(o=>o.cat===d.category&&(!d.search||[o.name,o.type,o.address].join(' ').toLowerCase().includes(d.search.toLowerCase())));}
function stats(){const v=G.part(steps,p);$('walkStats').innerHTML=[['Nights planned',`${v.nights} / ${G.days}`],['Beach nights',v.beach],['Allocated for two',money(v.allocated)]].map(([a,b])=>`<div><span>${e(a)}</span><strong>${e(b)}</strong></div>`).join('');}
function map(){
 const last=steps.at(-1).id,active=detail?.s.id||last,area=detail?.tab==='Places';
 const pois=area?places().map(o=>({...o,xy:WalkMap.coordinate(o.map)})).filter(o=>o.xy):[];
 $('mapcaption').textContent=area?`${D[active].name} · ${cats[detail.category]}`:view==='route'?'Your route':D[active].country;
 $('poilegend').hidden=!area;document.querySelector('.mapnote').textContent=area?'Venue coordinates · open Maps for streets':'QGIS world map · schematic connections';
 if(area&&!pois.length)$('mapcaption').textContent+=' · address links only';
 WalkMap.set({stops:steps,options:options.map(q=>q.s.id),active,mode:area?'area':view==='route'?'all':'network',pois,focus:detail?.focus||''},(id,role)=>{
  if(role==='place'){selectPlace(id);return;}
  if(area&&id===active){detail.tab='Overview';paint(true);return;}
  if(role==='next'){const q=options.find(x=>x.s.id===id);if(q)selection(q.s,steps.length);}
  else{const i=steps.map(s=>s.id).lastIndexOf(id);if(i>=0)selection(steps[i],i);}
 });
}
function paint(top=false){
 refresh();stats();const el=$('walkInfo'),foot=$('walkFoot');foot.innerHTML='';
 document.querySelectorAll('.walkswitch button').forEach(b=>{const on=b.dataset.w===(view==='detail'?back:view)+'-view';b.classList.toggle('on',on);b.setAttribute('aria-pressed',String(on));});
 if(view==='detail'){el.innerHTML=detailPanel();const reason=problem(),fresh=detail.i===steps.length;foot.innerHTML=`<div><span>Estimated stay for two</span><strong>${money(G.score(prefix(),detail.s,p,weights).cost)}</strong></div>${btn('confirm',fresh?'Add '+D[detail.s.id].name:'Apply changes',reason?'disabled':'','commit')}${reason?`<small role="status">${e(reason)}</small>`:''}`;}
 else if(view==='route')el.innerHTML=routePanel();
 else if(view==='weight')el.innerHTML=weightPanel();
 else if(view==='saved')el.innerHTML=savedPanel();
 else el.innerHTML=nextPanel();
 if(!storageOK&&!foot.innerHTML)foot.innerHTML='<small>Browser storage unavailable. Export your route to keep a copy.</small>';
 foot.hidden=!foot.innerHTML;
 if(top)$('walkScroll').scrollTop=0;
 try{map();}catch(error){$('mapcaption').textContent='Map unavailable · '+error.message;}
}
function nextPanel(){
 const last=steps.at(-1),idx=steps.length-1,end=R.start+G.nights(steps);
 const current=`<button class="current" data-w="edit" data-i="${idx}"><span>${tiny(idx?'Last confirmed stay':'Starting stay')}<b>${e(D[last.id].name)}</b></span><small>${day(end-last.n)} – ${day(end)}<br>${last.n} nights · Edit</small></button>`;
 if(last.id==='SEL')return title('Route complete','Arrival in Seoul')+current+`<p class="explain">Your trip ends on ${day(R.end)}. Open your route to review the stays and budget.</p>`+btn('route-view','Review route');
 if(!options.length)return title('Next stop','No onward connection')+current+`<p class="explain">Edit your previous stay or change your destination preferences to open another branch.</p>`+btn('route-view','Edit your route')+btn('prefs','Preferences');
 return current+title('Choose your next stop',`After ${D[last.id].name}`)+`<p class="explain">Select a point on the map or a destination below to explore a stay.</p><div class="nextlist">${options.map(({s,fit,ex,localScore})=>{
 const h=H[s.hotel],l=localScore.leg;return `<button class="nextcard" data-w="inspect" data-id="${s.id}"><span class="nexttop"><b>${e(D[s.id].name)}</b><span class="grade">${ex?Math.round(fit)+'/100':'Explore'}</span></span><span>${meta(D[s.id].beach?'Beach base':D[s.id].country,s.n+' nights',l.hours.toFixed(1)+' h transfer')}</span><span class="nexthotel">${e(h.name)} · ${money(G.rate(s.id,s.hotel))}/night</span>${!ex||ex.errors.length?`<small>${ex?'Check trip preferences':'No balanced finish at this duration'}</small>`:''}</button>`;
 }).join('')}</div>`;
}
function routePanel(){
 const v=G.part(steps,p);return title(`${steps.length} ${steps.length===1?'confirmed stay':'confirmed stays'}`,'Your route')+`<div class="timeline">${steps.map((s,i)=>{const x=v.stay[i];return `<button data-w="edit" data-i="${i}" class="stayrow"><i>${i+1}</i><span><b>${e(D[s.id].name)}</b><small>${day(x.start)} – ${day(x.end)} · ${s.n} nights</small><small>${e(H[s.hotel].name)}${s.picks.length?' · '+s.picks.length+' places':''}</small></span></button>`;}).join('')}</div><div class="ledger">${[['Rooms',v.rooms],['Daily spending',v.daily],['Transfers',v.travel],['Activities and other allowances',v.allocated-v.rooms-v.daily-v.travel],['Reserved extras',p.extras],['Budget remaining',p.budget-v.total]].map(([a,b])=>`<div><span>${e(a)}</span><b>${money(b)}</b></div>`).join('')}</div><p class="explain">${v.remaining} nights remaining · ${money(p.budget)} trip budget for two.</p>${steps.at(-1).id==='SEL'&&v.errors.length?`<p class="message">${v.errors.map(e).join(' ')}</p>`:''}<div class="wlinks">${btn('next-view','Next stop')}${steps.length>1?btn('back-step','Remove last stop'):''}${undo.length?btn('undo','Undo'):''}${btn('stash','Save or export')}</div>`;
}
function weightPanel(){return title('Suggestion model','Your criteria')+`<p class="explain">Next-stop fit combines this stay’s weighted scores (35%) with the best complete itinerary found from here (65%). Missing measurements are excluded from the local average.</p><form id="criteriaForm">${G.labels.map((n,i)=>`<label class="range">${e(n)}<output>${weights[i]}</output><input data-weight-index="${i}" type="range" min="0" max="100" value="${weights[i]}"></label>`).join('')}<button class="commit">Apply weights</button> ${btn('reset-weights','Workbook defaults')}</form><div class="section">${btn('prefs','Trip budget, pace and activity interests')} ${link(TRIP.source,'Source workbook')}</div>`;}
function hotelCard(hid,choose){
 const s=detail.s,h=H[hid],chosen=hid===s.hotel,shortlist=hid===TRIP.resorts[s.id];
 return `<article class="item${chosen?' picked':''}"><div class="itemheading"><b>${e(h.name)}</b><strong>${money(G.rate(s.id,hid))}<small>/night</small></strong></div><p>${meta(h.rating?h.rating+'/10 guest score':'',h.reviews?Number(h.reviews).toLocaleString('en-GB')+' reviews':'',shortlist?'Honeymoon shortlist':'',h.pool?'Pool':'')}</p><div class="wlinks">${choose?btn('hotel',chosen?'Selected':'Choose hotel',`data-id="${hid}" ${chosen?'disabled':''}`,chosen?'chosenbutton':'wbutton'):btn('tab','Compare hotels','data-tab="Hotels"')}${link(h.url,'Hotel listing')}${link(h.website,'Official site')}${link(h.map,'Maps')}</div></article>`;
}
function hotelPanel(){
 const all=G.hotelChoices(detail.s.id,p,weights),sort=detail.sort;
 if(sort==='price')all.sort((a,b)=>a.night-b.night);if(sort==='rating')all.sort((a,b)=>b.h.rating-a.h.rating||b.h.reviews-a.h.reviews);
 return `<div class="filterbar"><span>${all.length} priced hotels</span><label>Sort <select id="hotelSort">${[['fit','Best fit'],['price','Lowest price'],['rating','Guest rating']].map(([k,n])=>`<option value="${k}" ${sort===k?'selected':''}>${n}</option>`).join('')}</select></label></div><p class="explain">Fit weighs nightly price, guest ratings, honeymoon features, and reported cleanliness and Wi-Fi.</p>`+all.map(x=>hotelCard(x.id,true)).join('');
}
function placesPanel(){
 const counts=G.byBase[detail.s.id];return `<div class="catbar">${categories.map(c=>btn('category',`${cats[c]} (${counts.filter(o=>o.cat===c).length})`,`data-cat="${c}" aria-pressed="${c===detail.category}"`,c===detail.category?'active':'')).join('')}</div><label class="searchbox">Find a place<input id="placeSearch" type="search" placeholder="Name, cuisine or area" value="${e(detail.search)}"></label><div id="placeResults">${venueList()}</div>`;
}
function venueList(){
 const matches=places(),show=matches.slice(0,detail.limit);
 return (!matches.length?'<p class="explain">No matching places in this category.</p>':'')+show.map(o=>{const on=detail.s.picks.includes(o.id);const price=Number.isFinite(o.low)?money(o.low)+(Number.isFinite(o.high)&&o.high!==o.low?'–'+money(o.high):'')+' for two':o.cat==='Restaurants'?'Daily meal allowance':'Price unavailable';return `<article id="venue-${o.id}" class="item${detail.focus===o.id?' focused':''}"><div class="itemheading"><b>${e(o.name)}</b></div><p>${meta(o.type,o.rating,price)}</p>${o.desc?`<p>${e(o.desc)}</p>`:''}${o.address||o.hours?`<p>${meta(o.address,o.hours)}</p>`:''}<div class="wlinks">${btn('pick',on?'Remove from stay':'Add to stay',`data-id="${o.id}"`,on?'chosenbutton':'wbutton')}${WalkMap.coordinate(o.map)?btn('locate','Locate',`data-id="${o.id}"`,'textbutton'):''}${link(o.url,'Source')}${link(o.website,'Website')}${link(o.menu,'Menu')}${link(o.map,'Maps')}</div></article>`;}).join('')+(matches.length>show.length?btn('more','More places'):'');
}
function selectPlace(id){
 const o=M.activities.get(id);if(!detail||!o||o.base!==detail.s.id)return;
 if(detail.category!==o.cat){detail.category=o.cat;detail.search='';}
 detail.tab='Places';detail.focus=id;const pos=places().findIndex(x=>x.id===id);detail.limit=Math.max(10,detail.limit,pos+1);
 paint(false);$('venue-'+id)?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function scorePanel(local){
 return `<p class="explain">Weighted local fit <strong>${local.value===null?'—':Math.round(local.value)+'/100'}</strong>. Each criterion shows its measurement and source.</p>`+local.values.map((q,i)=>`<article class="criterion"><div><b>${e(G.labels[i])}</b><strong>${Number.isFinite(q.value)?Math.round(q.value)+'/100':'Unrated'}</strong></div><div class="meter"><i style="width:${Number.isFinite(q.value)?Math.max(0,Math.min(100,q.value)):0}%"></i></div><p>${e(q.detail)} ${link(q.url,'Source')}</p></article>`).join('')+link(TRIP.source,'Workbook and scoring inputs');
}
function overview(local){
 const s=detail.s,fresh=detail.i===steps.length,items=G.byBase[s.id],start=R.start+G.nights(prefix()),l=local.leg;
 let out=`<div class="nights"><div><b>${day(start)} – ${day(start+s.n)}</b><small>Length of stay</small></div><div class="stepper">${btn('minus','−','aria-label="One fewer night"')}<label><input id="stayNights" type="number" min="1" max="${G.days}" value="${s.n}" aria-label="Nights"><span>nights</span></label>${btn('plus','+','aria-label="One more night"')}</div></div>`;
 if(l)out+=`<p class="transfer">${meta(modeText(l),l.hours.toFixed(1)+' h',money(l.lo)+'–'+money(l.hi)+' for two')} ${link(l.url,'Transfer details')}</p>`;
 out+=`<h3>Your accommodation</h3>${hotelCard(s.hotel,false)}<h3>Places nearby</h3>`;
 for(const c of ['Restaurants','Sights','Activities']){const arr=items.filter(o=>o.cat===c);if(arr.length)out+=`<div class="tease">${tiny(cats[c])}${arr.slice(0,2).map(o=>btn('venue',o.name,`data-id="${o.id}"`,'textbutton')).join('')}</div>`;}
 out+=`<p class="explain">${s.picks.length} places selected · ${btn('tab','Explore all places','data-tab="Places"','textbutton')}</p>`;
 if(fresh){const ex=G.example(prefix(),s,p,detail.shapes,true);detail.example=ex;
  if(ex)out+=`<details class="example"><summary>See one possible finish · ${money(ex.total)}</summary><p>${e(ex.tail.map(t=>`${D[t.id].name} (${t.n}n)`).join(' → '))}</p><p>${ex.beach} beach nights · ${ex.hours.toFixed(1)} h in transit · whole-trip fit ${Math.round(ex.fit)}/100</p>${ex.errors.length?`<p>${ex.errors.map(e).join(' ')}</p>`:''}</details>`;
  else out+='<p class="message">The model found no balanced finish at this duration. Change the length or compare another branch.</p>';
 }return out;
}
function detailPanel(){
 const s=detail.s,d=D[s.id],local=G.score(prefix(),s,p,weights),fresh=detail.i===steps.length;
 return btn('back',fresh?'Back to next stops':'Back to route','','textbutton back')+title(`${d.country} · ${fresh?'Possible next stop':'Confirmed stay'}`,d.name)+`<p class="contextline">${meta(d.beach?'Beach base':'',s.n+' nights',money(G.rate(s.id,s.hotel))+'/night',local.value===null?'':Math.round(local.value)+'/100 local fit')}</p><div class="dtabs">${['Overview','Hotels','Places','Scores'].map(k=>btn('tab',k,`data-tab="${k}" aria-pressed="${detail.tab===k}"`,k===detail.tab?'active':'')).join('')}</div>`+(detail.tab==='Hotels'?hotelPanel():detail.tab==='Places'?placesPanel():detail.tab==='Scores'?scorePanel(local):overview(local));
}
function savedPanel(){
 return title('On this device','Saved routes')+`<p class="explain">Save a named copy to compare branches later. Export a route to open it on another device.</p><form id="nameForm"><label class="searchbox">Route name<input name="routeName" maxlength="70" required placeholder="Island honeymoon"></label><button class="commit">Save current route</button></form>`+saved.map((o,i)=>`<div class="savedrow"><span><b>${e(o.name)}</b><small>${o.steps.length} stays · ${G.nights(o.steps)} nights</small></span>${btn('load','Open',`data-i="${i}"`)}</div>`).join('')+`<div class="section wlinks">${btn('export','Export JSON')}${btn('import','Import JSON')}<input hidden id="importSteps" type="file" accept=".json,application/json">${btn('restart','Start again in Bangkok')}${undo.length?btn('undo','Undo'):''}</div>`;
}
function confirm(){
 if(!detail||problem())return;const fresh=detail.i===steps.length,id=detail.s.id;mark();steps=proposed();storeDraft();show(fresh?'next':'route');api.notify((fresh?'Added ':'Updated ')+D[id].name);
}
function night(val){if(!Number.isInteger(val)||val<1||val>G.days){api.notify('Choose 1 to 80 whole nights.');paint(false);return;}detail.s.n=val;paint(false);}
function exportRoute(){const url=URL.createObjectURL(new Blob([JSON.stringify(payload(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='honeymoon-route.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
$('walk').addEventListener('click',evt=>{
 const el=evt.target.closest('[data-w]');if(!el||el.disabled)return;const a=el.dataset.w,id=el.dataset.id,i=Number(el.dataset.i);
 if(['next-view','route-view','weight-view'].includes(a)){show(a.split('-')[0]);return;}
 switch(a){
 case 'zoom-in':WalkMap.zoom(.7);break;
 case 'zoom-out':WalkMap.zoom(1.43);break;
 case 'fit-map':WalkMap.fit(true);break;
 case 'stash':show('saved');break;
 case 'prefs':api.openPreferences();break;
 case 'inspect':{const q=options.find(x=>x.s.id===id);if(q)selection(q.s,steps.length);break;}
 case 'edit':if(steps[i])selection(steps[i],i);break;
 case 'back':show(back);break;
 case 'tab':detail.tab=el.dataset.tab;paint(true);break;
 case 'minus':night(detail.s.n-1);break;
 case 'plus':night(detail.s.n+1);break;
 case 'hotel':if(H[id]?.base===detail.s.id){detail.s.hotel=id;paint(false);api.notify('Hotel selected for this preview.');}break;
 case 'category':detail.category=el.dataset.cat;detail.search='';detail.limit=10;detail.focus='';paint(false);break;
 case 'venue':case 'locate':selectPlace(id);break;
 case 'pick':{const arr=detail.s.picks;if(M.activities.get(id)?.base!==detail.s.id)break;detail.s.picks=arr.includes(id)?arr.filter(k=>k!==id):[...arr,id];paint(false);break;}
 case 'more':detail.limit+=15;paint(false);break;
 case 'confirm':confirm();break;
 case 'back-step':if(steps.length>1){mark();steps=steps.slice(0,-1);storeDraft();show('next');}break;
 case 'undo':if(undo.length){restore(undo.pop());storeDraft();show('route');}break;
 case 'reset-weights':mark();weights=[...G.defaultWeights];storeDraft();paint(false);break;
 case 'load':if(saved[i]){mark();restore(saved[i]);storeDraft();show('route');}break;
 case 'restart':mark();steps=[G.first(p,weights)];storeDraft();show('next');break;
 case 'export':exportRoute();break;
 case 'import':$('importSteps').click();break;
 }});
$('walk').addEventListener('submit',evt=>{
 evt.preventDefault();
 if(evt.target.id==='criteriaForm'){const w=[...evt.target.querySelectorAll('[data-weight-index]')].map(el=>+el.value);if(!validWeights(w)){api.notify('Give at least one criterion a positive weight.');return;}mark();weights=w;storeDraft();paint(false);api.notify('New weights applied to next-stop suggestions.');}
 if(evt.target.id==='nameForm'){const name=evt.target.elements.routeName.value.trim();if(!name)return;saved.push({...payload(),name});storeDraft();paint(false);api.notify('Route saved.');}
});
$('walk').addEventListener('input',evt=>{
 const el=evt.target;if(el.dataset.weightIndex!==undefined)el.parentElement.querySelector('output').value=el.value;
 if(el.id==='placeSearch'){detail.search=el.value;detail.limit=10;detail.focus='';$('placeResults').innerHTML=venueList();map();}
});
$('walk').addEventListener('change',async evt=>{
 const el=evt.target;if(el.id==='stayNights')night(+el.value);
 if(el.id==='hotelSort'){detail.sort=el.value;paint(false);}
 if(el.id==='importSteps'&&el.files?.length){try{const file=el.files[0];if(file.size>150000)throw Error();const o=JSON.parse(await file.text());if(!validFile(o))throw Error();mark();restore(o);storeDraft();show('route');api.notify('Route imported.');}catch{api.notify('Choose a valid route exported from the step-by-step builder.');}}
});
for(const [evt,on] of [['mouseover',true],['mouseout',false],['focusin',true],['focusout',false]])$('walkInfo').addEventListener(evt,x=>{const card=x.target.closest('.nextcard');if(card)WalkMap.hover(card.dataset.id,on);});
globalThis.StepBuilder={connect(a){api=a;},render(pref){p=pref;if(!steps)init();paint();},openSaved(){show('saved');}};
})();
