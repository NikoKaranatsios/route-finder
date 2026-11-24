(function engine(){
'use strict';
const D=TRIP.dest,H=TRIP.hotels,L=TRIP.legs,R=TRIP.rules,M=AtlasModel;
const ids=Object.keys(D),countries=M.countryOrder,days=R.end-R.start;
const byBase=Object.fromEntries(ids.map(id=>[id,PLACES.filter(o=>o.base===id)]));
const local=Object.fromEntries(ids.map(id=>[id,byBase[id].filter(o=>o.cat==='Activities').map(o=>STOP_EVIDENCE.experiences.find(e=>e.name===o.name&&e.country===D[id].country)).filter(x=>x&&x.criteria[0]>0&&x.criteria[1]>0)]));
const next=Object.fromEntries(ids.map(id=>[id,Object.keys(L).filter(k=>k.startsWith(id+'-')).map(k=>k.split('-')[1])]));
const sum=(a,f)=>a.reduce((n,x)=>n+f(x),0),nights=a=>sum(a,s=>s.n);
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const labels=['Price','Cleanliness','Safety','Accessibility','Internet','Authenticity'];
const defaultWeights=STOP_EVIDENCE.weights;
const typical={BKK:5,KBI:12,KPN:14,CNX:6,CEI:4,HAN:5,NBI:5,HANM:14,DAD:13,PQC:16,DLI:5,SGN:4,KIX:6,KYO:7,TYO:6,SEL:3};
const rate=(id,h)=>h===D[id].hotel?D[id].night:H[h].price;
const mk=(id,n=typical[id],hotel='')=>({id,n,hotel,picks:[],pin:false});
function hotelChoices(id,p,w){
 const nightly=Math.max(1,(p.budget-p.extras)/days-D[id].daily);
 return Object.entries(H).filter(([,h])=>h.base===id&&h.eligible).map(([key,h])=>{
  const priceScore=clamp(100*nightly/Math.max(1,rate(id,key)));
  const terms=[[Number.isFinite(h.rating)?h.rating*10:NaN,20],[priceScore,w[0]],[Number.isFinite(h.clean)?h.clean*10:NaN,w[1]],[Number.isFinite(h.wifi)?h.wifi*10:NaN,w[4]],[key===TRIP.resorts[id]?100:h.pool?42:0,p.resortWeight]];
  const seen=terms.filter(([v,weight])=>Number.isFinite(v)&&weight>0);
  return {id:key,h,night:rate(id,key),score:sum(seen,t=>t[0]*t[1])/sum(seen,t=>t[1])};
 }).sort((a,b)=>b.score-a.score||a.night-b.night);
}
function first(p,w){return mk('BKK',5,hotelChoices('BKK',p,w)[0].id);}
function part(stops,p){
 const e=M.evaluate(stops,p);
 return {...e,allocated:e.total-p.extras,remaining:days-nights(stops),arrival:R.start+nights(stops)};
}
function localMean(id,column,p){const evidence=local[id].filter(e=>Number.isFinite(e.criteria[column])&&p.activities[e.category]>0);
 const weight=sum(evidence,e=>p.activities[e.category]);return weight?{score:20*sum(evidence,e=>e.criteria[column]*p.activities[e.category])/weight,count:evidence.length,example:evidence[0]}:null;}
function score(prefix,s,p,w){
 const d=D[s.id],h=H[s.hotel],country=STOP_EVIDENCE.countries[d.country];
 const prev=prefix.at(-1),leg=prev?L[prev.id+'-'+s.id]:null;
 const totalFor=(a)=>part(a,p).allocated;
 const stayCost=totalFor([...prefix,s])-totalFor(prefix);
 const allowance=Math.max(1,(p.budget-p.extras)/days),price=clamp(100-50*stayCost/(s.n*allowance));
 const safe=localMean(s.id,4,p),auth=localMean(s.id,7,p);
 const access=leg?clamp(100-8*leg.hours):null;
 const internet=Number.isFinite(h.wifi)?h.wifi*10:20*(country.mobile>=200?5:country.mobile>=100?4:country.mobile>=50?3:country.mobile>=20?2:1);
 const vals=[
 {value:price,detail:`€${Math.round(stayCost/s.n)} per night for two including this transfer and picks. Daily trip allowance €${Math.round(allowance)}. Spending the allowance scores 50.`,url:h.url},
 {value:Number.isFinite(h.clean)?h.clean*10:country.clean,detail:Number.isFinite(h.clean)?`Hotel guest cleanliness ${h.clean}/10.`:`Property score unavailable. Country clean-and-tidy survey ${country.clean}/100.`,url:Number.isFinite(h.clean)?h.url:country.cleanSource},
 {value:safe?.score??null,detail:safe?`Activity precautions across ${safe.count} rated local experience(s), weighted by your interests. Higher means fewer special precautions. Country advisory in the workbook: level ${country.advisory}/4.`:'No rated local activity with a positive interest weight.',url:country.safetySource},
 {value:access,detail:leg?`Incoming transfer ${leg.hours.toFixed(1)} h. Starts at 100 and deducts 8 points per hour.`:'Arrival city. Your inbound flight is outside the transfer graph.',url:leg?.url},
 {value:internet,detail:Number.isFinite(h.wifi)?`Hotel guest Wi-Fi score ${h.wifi}/10.`:`Property score unavailable. National mobile median ${country.mobile} Mbps, scored using workbook speed bands.`,url:Number.isFinite(h.wifi)?h.url:country.internetSource},
 {value:auth?.score??null,detail:auth?`Local character of ${auth.count} rated experience(s), weighted by your interests. This is an editorial judgment.`:'No rated local activity with a positive interest weight.',url:auth?.example?.source}];
 const denom=vals.reduce((n,v,i)=>n+(Number.isFinite(v.value)?w[i]:0),0);
 return {values:vals,value:denom?vals.reduce((n,v,i)=>n+(Number.isFinite(v.value)?w[i]*v.value:0),0)/denom:null,cost:stayCost,leg};
}
// Generate graph paths independently of the route catalog. A return to Hanoi from Ninh Bình
// is supported because it is a modeled gateway. All other bases appear at most once.
function continuations(prefix,id,p){
 const visited=prefix.map(s=>s.id),templates=new Map();
 for(const r of TRIP.routes){for(let pos=0;pos<r.stops.length;pos++){if(r.stops[pos][0]!==id)continue;const suffix=r.stops.slice(pos);const key=suffix.map(s=>s.join(':')).join('|');templates.set(key,suffix);}}
 const paths=[];function dfs(path){
  const last=path.at(-1),all=[...visited,...path];
  if(last==='SEL'){paths.push(path);return;}
  for(const n of next[last]){
   if(all.includes(n)&&!(n==='HAN'&&last==='NBI'&&all.filter(x=>x==='HAN').length===1))continue;
   if(p.avoid.includes(n))continue;dfs([...path,n]);
  }}
 dfs([id]);
 const good=new Set(paths.map(a=>a.join(',')));
 const shapes=[...templates.values()].filter(a=>good.has(a.map(x=>x[0]).join(',')));
 const known=new Set(shapes.map(a=>a.map(x=>x[0]).join(',')));
 for(const path of paths)if(!known.has(path.join(',')))shapes.push(path.map(c=>[c,typical[c]]));
 return shapes;
}
// Allocate remaining whole nights in proportion to the suggested durations, respecting Tokyo,
// already chosen stays and a short Seoul finish where the remaining graph permits it.
function allocate(prefix,shape,p,fixed=null){
 const left=days-nights(prefix),count=shape.length;
 if(!count||left<count||prefix.some(s=>s.id==='SEL'))return null;
 const min=shape.map(([id])=>id==='SEL'?R.seoul:1);
 const max=shape.map(([id])=>id==='TYO'&&p.tokyo>0?Math.max(0,p.tokyo-sum(prefix,s=>s.id==='TYO'?s.n:0)):id==='SEL'?Math.max(R.seoul,4):D[id].beach?R.seaside+2:R.inland+1);
 if(fixed!==null){const hard=shape[0][0]==='TYO'&&p.tokyo?max[0]:days;if(fixed<min[0]||fixed>hard)return null;min[0]=max[0]=fixed;}
 if(max.some((m,i)=>m<min[i])||sum(min,n=>n)>left||sum(max,n=>n)<left)return null;
 let amounts=[...min],remaining=left-sum(min,n=>n);
 while(remaining--){let idx=-1,priority=-Infinity;for(let i=0;i<count;i++){if(amounts[i]>=max[i])continue;const rel=shape[i][1]/(amounts[i]+.5);if(rel>priority){priority=rel;idx=i;}}amounts[idx]++;}
 return shape.map(([code],i)=>mk(code,amounts[i]));
}
function example(prefix,s,p,shapes,fix){
 let best=null;
 for(const shape of shapes){
  const tail=allocate(prefix,shape,p,fix?s.n:null);if(!tail)continue;
  tail[0]={...s,n:tail[0].n};const full=[...prefix,...tail],v=M.evaluate(full,p);
  const item={tail,fit:v.fit,total:v.total,errors:v.errors,hours:v.hours,beach:v.beach};
  if(!best||item.errors.length<best.errors.length||(item.errors.length===best.errors.length&&(item.fit>best.fit||item.fit===best.fit&&item.total<best.total)))best=item;
 }
 return best;
}
function options(prefix,p,w){
 if(!prefix.length||prefix.at(-1).id==='SEL'||nights(prefix)>=days)return [];
 const last=prefix.at(-1).id;
 return next[last].filter(id=>!p.avoid.includes(id)&&(!prefix.some(s=>s.id===id)||(id==='HAN'&&last==='NBI'&&prefix.filter(s=>s.id==='HAN').length===1))).map(id=>{
  const ranked=hotelChoices(id,p,w);if(!ranked.length)return null;let s=mk(id,typical[id],ranked[0].id);
  const shapes=continuations(prefix,id,p),ex=example(prefix,s,p,shapes,false);
  if(!ex&&!shapes.length)return null;s={...s,n:ex?ex.tail[0].n:id==='SEL'?Math.max(1,days-nights(prefix)):Math.min(s.n,Math.max(1,days-nights(prefix)))};const localScore=score(prefix,s,p,w);
  return {s,shapes,ex,localScore,fit:ex?(localScore.value??ex.fit)*.35+ex.fit*.65:0};
 }).filter(Boolean).sort((a,b)=>(a.ex?.errors.length??100)-(b.ex?.errors.length??100)||b.fit-a.fit||(a.ex?.total??Infinity)-(b.ex?.total??Infinity));
}
function validStops(ss){
 if(!Array.isArray(ss)||!ss.length||ss.length>80||ss[0].id!=='BKK')return false;
 return nights(ss)<=days&&ss.every((s,i)=>Object.hasOwn(D,s.id)&&Number.isInteger(s.n)&&s.n>=1&&H[s.hotel]?.base===s.id&&Array.isArray(s.picks)&&s.picks.every(k=>M.activities.get(k)?.base===s.id)&&(!i||!!L[ss[i-1].id+'-'+s.id])&&(s.id!=='SEL'||(i===ss.length-1&&nights(ss)===days&&s.n>=R.seoul)));
}
globalThis.StepGraph={byBase,local,next,days,first,rate,nights,part,score,example,continuations,options,allocate,hotelChoices,validStops,labels,defaultWeights};
})();
