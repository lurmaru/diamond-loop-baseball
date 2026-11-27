/* April through March, including both the opening ceremony and graduation day. */
(function(){
  'use strict';
  const months=[30,31,30,31,31,30,31,30,31,31,28,31];
  const starts=months.map((_,i)=>months.slice(0,i).reduce((a,b)=>a+b,0));
  const days=months.flatMap((length,i)=>Array.from({length},(_,j)=>((i+3)%12+1)+'月'+(j+1)+'日'));
  const events={policy:30,summerCamp:71,summer:111,autumn:183,alumni:224,winterCamp:244,rumor:275,spring:334,end:364};
  const stops=Object.values(events);
  const date=day=>days[day];
  function make(random,qualified=false){
    const tiles=days.map(()=>{
      const roll=random();
      return roll<.045?'good':roll<.063?'bad':'plain';
    });
    const outings=['shop','event','friendly'];
    for(let i=0,day=9;day<364;day+=9,i++){
      tiles[day+Math.floor(random()*5)]=outings[i%3];
    }
    tiles.length=365;
    for(const [d,t] of [[0,'plain'],[1,'good'],[2,'shop'],[4,'event'],[5,'friendly'],[6,'bad']])tiles[d]=t;
    for(const [t,d] of Object.entries(events))tiles[d]=t.endsWith('Camp')?'camp':t;
    if(!qualified)tiles[events.spring]='plain';
    return tiles;
  }
  function landing(s,c){
    const next=stops.find(d=>d>s.day&&(s.qualified||d!==events.spring))??events.end;
    return Math.min(next,s.day+c.steps);
  }
  function fromOld(day){
    if(day===35)return events.end;
    return starts[Math.floor(day/3)]+10*(day%3);
  }
  function migrate(s){
    const old=s.tiles||[];
    let seed=s.rng;
    const tiles=make(()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296),s.qualified);
    old.forEach((t,i)=>{if(i<36&&!stops.includes(fromOld(i)))tiles[fromOld(i)]=t;});
    s.tiles=tiles;s.day=fromOld(s.day);
  }
  const api={days,starts,events,date,make,landing,fromOld,migrate};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else globalThis.ClubCalendar=api;
})();
