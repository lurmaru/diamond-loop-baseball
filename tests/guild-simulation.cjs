const assert=require('node:assert/strict');
const G=require('../guild-engine.js');
function campaign(seed,years,guided,climb=true,movement='auto'){
  let s=G.initial(seed),ai=seed>>>0;
  const next=n=>{ai=(Math.imul(ai,1103515245)+12345)>>>0;return Math.floor(ai/4294967296*n);};
  const stats=[],phases=new Set();
  let year,actions=0,rooms=0;
  while(s.year<=years){
    if(++actions>years*800)throw Error('Campaign stalled in '+s.phase);
    if(s.year!==year){year=s.year;stats.push({summer:0,spring:0,gate:0,depth:s.depth,battles:0,losses:0,turns:0});}
    const row=stats.at(-1);phases.add(s.phase);
    if(s.notice){assert.ok(G.acknowledge(s));continue;}
    let ok=false;
    switch(s.phase){
      case 'intake':if(!s.drawn)ok=G.reveal(s,true);else ok=G.accept(s,s.pack.reduce((a,b)=>a.rank>b.rank?a:b).id);break;
      case 'build':{
        const best=s.library.slice().sort((a,b)=>b.tier-a.tier||Number(b.evolved)-Number(a.evolved));
        for(const c of best.slice(0,Math.max(12,s.handSize+1)))if(!s.draft.includes(c.id))G.toggle(s,c.id);
        ok=G.lock(s);break;
      }
      case 'practice':{
        if(climb&&s.depth<=s.cleared)G.depth(s,s.cleared+1);
        for(const i of [0,2,1,3,4].sort((a,b)=>s.facility[a]-s.facility[b])){
          if(G.upgrade(s,i))break;
        }
        if(movement==='auto'){ok=G.auto(s);break;}
        const ds=s.cards.map(c=>G.distance(s,c)),target=movement==='short'?Math.min(...ds):Math.max(...ds);
        ok=G.train(s,ds.indexOf(target));break;
      }
      case 'camp':ok=G.camp(s,s.cards.findIndex(c=>c.mentor)>=0?s.cards.findIndex(c=>c.mentor):0);break;
      case 'mentor':{const c=s.library.find(c=>c.k===s.teacher.k&&!c.mentor);ok=c?G.teach(s,c.id):G.skipMentor(s);break;}
      case 'evolve':ok=G.teach(s,s.library.find(c=>!c.evolved&&c.effect!=='chain').id);break;
      case 'oath':ok=G.chooseOath(s,s.blessings.indexOf('journey'));break;
      case 'shop':{
        const i=s.offers.findIndex(id=>!G.D.card(s,id)&&s.gold>=G.price(id));
        ok=s.handSize<7&&G.visit(s,4)||i>=0&&G.visit(s,i)||G.visit(s,5)||G.visit(s,3);break;
      }
      case 'event':ok=G.visit(s,1);break;
      case 'friendly':ok=G.visit(s,s.weak);break;
      case 'loot':ok=G.visit(s,s.offers.length?0:3);break;
      case 'prepare':{
        if(guided){
          for(let k=0;k<3;k++){
            const score=p=>p.stats[k]+3*p.arts[k];
            const best=s.roster.filter(p=>p.role%3===k).sort((a,b)=>score(b)-score(a))[0];
            if(best)G.setParty(s,best.id,k);
          }
        }
        ok=G.launch(s);break;
      }
      case 'battle':{
        const e=s.expedition;
        const k=guided?(e.intent===0?2:e.intent===1&&e.mp>=2?1:e.foe===1&&e.mp>=2?1:0):[0,2,...(e.mp>=2?[1]:[])][next(e.mp>=2?3:2)];
        ok=G.strike(s,k);row.turns++;break;
      }
      case 'result':{
        const e=s.expedition;row.battles++;rooms++;
        if(!e.won)row.losses++;
        if(e.finished&&e.won)row[e.kind==='autumn'?'gate':e.kind]=1;
        const priority=e.hp<e.maxHP*.70?[1,2,0,3,4]:[2,0,3,4,1];
        const pick=e.finished?0:guided?e.rewards.indexOf(priority.find(r=>e.rewards.includes(r))):next(e.rewards.length);
        ok=G.advance(s,pick);break;
      }
      case 'succession':{
        row.mean=s.roster.reduce((a,p)=>a+p.stats.reduce((x,y)=>x+y,0),0)/(3*s.roster.length);
        row.cards=s.library.length;row.facilities=s.facility.reduce((a,b)=>a+b,0);row.deep=s.cleared+1;
        ok=G.succession(s,s.roster.find(p=>s.year-p.year>=2)?.id||0);break;
      }
    }
    assert.ok(ok,'Unresolved '+s.phase);assert.ok(s.gold>=0&&s.stars>=0);
  }
  return {stats,phases,rooms,state:s};
}
if(require.main===module){
  const count=Number(process.argv[2]||500),years=Number(process.argv[3]||8);
  for(const [guided,climb,movement] of [[false,false,'auto'],[true,false,'auto'],[true,true,'auto'],[true,false,'short'],[true,false,'long']]){
    const length=movement==='auto'?years:Math.min(years,3),totals=Array.from({length},()=>({})),phases=new Set();
    let battles=0;
    for(let i=0;i<count;i++){
      const run=campaign((i+1)*971,length,guided,climb,movement);battles+=run.rooms;
      for(const p of run.phases)phases.add(p);
      run.stats.forEach((r,j)=>{for(const k in r)totals[j][k]=(totals[j][k]||0)+r[k];});
    }
    console.log(JSON.stringify({count,guided,climb,movement,battles,phases:[...phases].length,years:totals.map((r,i)=>({year:i+1,summer:+(100*r.summer/count).toFixed(1),gate:+(100*r.gate/count).toFixed(1),spring:+(100*r.spring/count).toFixed(1),depth:+(r.deep/count).toFixed(2),mean:+(r.mean/count).toFixed(1),cards:+(r.cards/count).toFixed(1),facilities:+(r.facilities/count).toFixed(1)})).filter((r,i)=>[0,2,length-1].includes(i))}));
  }
  const long=campaign(91313,100,true);console.log('100 years: completed, highest depth cleared',long.state.cleared+1,'and veterans',long.state.veterans.length);
}
module.exports={campaign};
