'use strict';
globalThis.AtlasModel = (() => {
  const {dest, hotels, legs, rules: r} = TRIP;
  const activities = new Map(PLACES.map(p => [p.id, p]));
  const countryOrder = ['Thailand','Vietnam','Japan','South Korea'];
  const clamp = (n, low=0, high=100) => Math.min(high, Math.max(low, n));
  const serial = iso => Date.parse(iso+'T00:00:00Z')/86400000+25569;
  const iso = n => new Date((n-25569)*86400000).toISOString().slice(0,10);
  const clone = x => JSON.parse(JSON.stringify(x));
  const fromRoute = route => ({base:route.id, stops:route.stops.map(([id,n]) => ({id,n,hotel:'',picks:[],pin:false}))});
  function evaluate(stops,p) {
    const distinct = new Set(stops.map(s=>s.id)), totals={}, errors=[], notes=[];
    let chosen = -1, cheapest=Infinity;
    const explicit = stops.some(s=>s.hotel && s.hotel===TRIP.resorts[s.id] && s.n>=p.resort);
    stops.forEach((s,i)=>{
      totals[s.id]=(totals[s.id]||0)+s.n;
      const h=hotels[TRIP.resorts[s.id]];
      if (!explicit && p.resortWeight>0 && !s.hotel && s.n>=p.resort && h?.eligible) {
        const delta=(h.price-dest[s.id].night)*s.n;
        if(delta<cheapest){chosen=i;cheapest=delta;}
      }
    });
    let clock=r.start,rooms=0,daily=0,travel=0,lo=0,hi=0,hours=0,options=0,unpriced=0,resortNights=0,beach=0,tet=0,moon=false,sumo=false,blossom=false;
    let hotelPoints=0,food=0,shopping=0,sights=0;
    const seen=new Set();
    const stay=stops.map((s,i)=>{
      const d=dest[s.id], start=clock,end=clock+s.n;clock=end;
      const hotelId=s.hotel || (i===chosen?TRIP.resorts[s.id]:d.hotel), h=hotels[hotelId];
      const room=hotelId===d.hotel?d.night:h?.price;
      const leg=i?legs[stops[i-1].id+'-'+s.id]:null;
      if(i && !leg) errors.push('Missing transfer estimate: '+dest[stops[i-1].id].name+' → '+d.name+'.');
      if(i && countryOrder.indexOf(d.country)<countryOrder.indexOf(dest[stops[i-1].id].country)) errors.push('Country order changes before '+d.name+'.');
      if(!h || !Number.isFinite(room))errors.push('Missing room price in '+d.name+'.');
      if(!Number.isInteger(s.n)||s.n<1)errors.push('Each stop needs at least one whole night.');
      const roomTotal=(room||0)*s.n, living=(s.n+(i===stops.length-1&&s.id==='SEL'?r.departure:0))*d.daily;
      rooms+=roomTotal;daily+=living;travel+=leg?.cost||0;hours+=leg?.hours||0;lo+=leg?.lo||0;hi+=leg?.hi||0;
      if(d.beach)beach+=s.n;
      if(hotelId===TRIP.resorts[s.id]&&s.n>=p.resort)resortNights=Math.max(resortNights,s.n);
      if(!seen.has(s.id)){options+=d.extra+(TRIP.daytrips[s.id]?.extra||0);seen.add(s.id);}
      for(const id of s.picks){const o=activities.get(id);if(!o) continue;
        if(o.cat==='Activities' && o.low!==null) options+=(o.low+(o.high??o.low))/2;
        else if(o.cat!=='Restaurants')unpriced++;
      }
      const overlaps=(a,b)=>start<=serial(b)&&end>serial(a);
      moon ||= s.id==='KPN'&&overlaps('2027-01-22','2027-01-22');
      sumo ||= s.id==='KIX'&&overlaps('2027-03-14','2027-03-28');
      blossom ||= s.id==='TYO'&&overlaps('2027-03-24','2027-03-28');
      if(i && start>=r.tetStart && start<=r.tetEnd && (d.country==='Vietnam'||dest[stops[i-1].id].country==='Vietnam'))tet++;
      hotelPoints+=(h?.rating||0)*10*s.n;food+=d.food*s.n;shopping+=d.shops*s.n;sights+=d.sights*s.n;
      return {start,end,hotelId,room,roomTotal,living,leg};
    });
    const nights=clock-r.start,target=r.end-r.start,coasts=[...distinct].filter(c=>dest[c].beach);
    const total=rooms+daily+travel+options+(nights+r.departure)*r.buffer+tet*r.tetCost+p.extras;
    if(nights!==target)errors.push((nights<target?'Add ':'Remove ')+Math.abs(target-nights)+' nights to meet the Seoul flight.');
    if(stops[0]?.id!=='BKK'||stops.at(-1)?.id!=='SEL')errors.push('Start in Bangkok and finish in Seoul.');
    for(const c of countryOrder)if(!stops.some(s=>dest[s.id].country===c))errors.push('Include an overnight stay in '+c+'.');
    if((totals.SEL||0)<r.seoul)errors.push('Keep at least '+r.seoul+' nights in Seoul.');
    if(p.tokyo>0 && (totals.TYO||0)>p.tokyo)errors.push('Tokyo exceeds your '+p.tokyo+'-night cap.');
    if(total>p.budget)errors.push('Estimated cost exceeds your budget.');
    for(const id of p.must)if(!distinct.has(id))errors.push('Required stop missing: '+dest[id].name+'.');
    for(const id of p.avoid)if(distinct.has(id))errors.push('Excluded stop present: '+dest[id].name+'.');
    if(p.moon&&!moon)errors.push('Misses the Full Moon Party window.');
    if(p.sumo&&!sumo)errors.push('Misses the Osaka sumo window.');
    if(p.blossom&&!blossom)errors.push('Misses the Tokyo blossom window.');
    if(p.avoidTet&&tet)errors.push('Includes a Vietnam transfer in the Tết window.');
    const beachFit=p.coast>0?clamp(100*beach/p.coast):100;
    let pace=100-r.stopsPenalty*(Math.max(0,p.minStops-distinct.size)+Math.max(0,stops.length-p.maxStops));
    for(const [id,n] of Object.entries(totals))pace-=Math.max(0,n-(dest[id].beach?r.seaside:r.inland))*(dest[id].beach?r.seasidePenalty:r.inlandPenalty);
    pace-=r.shortPenalty*stops.reduce((sum,s)=>sum+Math.max(0,r.short-s.n),0);pace=clamp(pace);
    const actScores=p.activities.map((weight,k)=>Math.max(0,...[...distinct].map(id=>{
      let v=dest[id].activities[k];if(k===3&&id==='KPN'&&!moon)v=0;if(k===4&&id==='TYO'&&!blossom)v*=.6;if(k===11&&id==='KIX'&&!sumo)v=0;return v;
    })));
    let aw=0,av=0;p.activities.forEach((w,k)=>{if(k!==2){aw+=w;av+=w*actScores[k];}});
    const [wact,wh,wf,wshop,wsight,wwish]=r.otherWeights;
    const wishTotal=Object.values(dest).reduce((a,d)=>a+d.wish,0);
    const points=[[clamp(100-Math.max(0,100*total/p.budget-r.budgetShare)),p.budgetWeight],[aw?av/aw:0,aw?wact:0],[hotelPoints/(nights||1),wh],[food/(nights||1),wf],[shopping/(nights||1),wshop],[sights/(nights||1),wsight],[clamp(100*(r.hoursMax-hours)/(r.hoursMax-r.hoursMin||1)),p.timeWeight],[wishTotal?100*[...distinct].reduce((a,id)=>a+dest[id].wish,0)/wishTotal:0,wishTotal?wwish:0],[beachFit,p.beachWeight*p.activities[2]/5],[pace,p.paceWeight],[resortNights?100:0,p.resortWeight]];
    const fit=points.reduce((a,[v,w])=>a+v*w,0)/(points.reduce((a,[,w])=>a+w,0)||1);
    return {nights,beach,countries:new Set(stops.map(s=>dest[s.id].country)).size,coasts,rooms,daily,travel,options,total,hours,lo:total-travel+lo,hi:total-travel+hi,unpriced,resortNights,tet,moon,sumo,blossom,pace,fit:Math.round(fit*100)/100,errors,stay,totals};
  }
  // Preserve the number, order, lengths and selections of pinned stays.
function rebalance(a,p){let n=a.reduce((s,x)=>s+x.n,0),target=r.end-r.start;while(n!==target){const sign=n<target?1:-1;let idx=-1,bestFit=-Infinity;for(let i=0;i<a.length;i++){const s=a[i];if(s.pin||s.n+sign<(s.id==='SEL'?r.seoul:1)||s.n+sign>80||(sign>0&&s.id==='TYO'&&p.tokyo>0&&s.n>=p.tokyo))continue;s.n+=sign;const v=evaluate(a,p);s.n-=sign;const quality=v.fit-v.errors.length*10-Math.max(0,v.total-p.budget)/p.budget;if(quality>bestFit){bestFit=quality;idx=i;}}if(idx<0)return false;a[idx].n+=sign;n+=sign;}return true;}
  function ranked(plan,p,adapt=false) {
    const pins=plan.stops.filter(s=>s.pin);
    const out=[];
    for(const route of TRIP.routes){
      const draft=fromRoute(route);let last=-1,valid=true,adjusted=false;
      for(const pin of pins){
        const j=draft.stops.findIndex((s,i)=>i>last && s.id===pin.id && (adapt || s.n===pin.n));
        if(j<0){valid=false;break;}
        adjusted ||= draft.stops[j].n!==pin.n;draft.stops[j]=clone(pin);last=j;
      }
      if(!valid || (adjusted && !rebalance(draft.stops,p)))continue;
      const m=evaluate(draft.stops,p);
      if(!m.errors.length)out.push({draft,m,adjusted});
    }
    return out.sort((a,b)=>b.m.fit-a.m.fit||a.draft.base.localeCompare(b.draft.base));
  }
  // Split a neighboring unlocked stay so adding a destination preserves the departure date.
  function insertions(stops,onlyId=''){
    const candidates=[];
    for(let at=1;at<stops.length;at++){
      const before=stops[at-1],after=stops[at];
      for(const id of Object.keys(dest)){
        if(onlyId&&onlyId!==id||id===before.id||id===after.id||['SEL','BKK'].includes(id))continue;
        if(!legs[before.id+'-'+id]||!legs[id+'-'+after.id])continue;
        for(const donor of [at-1,at]){
          const s=stops[donor],min=s.id==='SEL'?r.seoul:r.short;
          const available=s.pin?0:s.n-min;
          if(available>=1)candidates.push({at,id,donor,max:available,n:Math.min(3,available)});
        }
      }
    }
    return candidates;
  }
  function applyInsert(stops,c,n){const next=clone(stops);next[c.donor].n-=n;next.splice(c.at,0,{id:c.id,n,hotel:'',picks:[],pin:false});return next;}
  return {rebalance,clone,iso,fromRoute,evaluate,ranked,insertions,applyInsert,activities,countryOrder};
})();
