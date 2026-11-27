const assert = require('node:assert/strict');
const G = require('../engine.js');
const best = scores => scores.indexOf(Math.max(...scores));
const sample = (s, salt) => ((s.rng >>> 8) + salt) % 3;

function campaign(seed, years, guided, challenge, audit=false, movement) {
  let s=G.initial(seed);
  const history=[];
  const sign=()=>{
    while(G.flip(s)){}
    const i=best(s.pack.map(p=>p.stats.reduce((a,b)=>a+b)+8*p.genius));
    assert.ok(G.enroll(s,s.pack[i].id));
    if(s.year===1)assert.equal(s.phase,'practice');else assert.ok(G.lockDeck(s));
  };
  sign();
  for (let year=1;year<=years;year++) {
    const previous=s.titles,rookies=s.roster.filter(p=>p.grade===1);
    let guard=0,practices=0,visits=0,lastVisitDay=-1;
    if(challenge && year>=3) G.setChallenge(s,Math.max(1,s.record));
    while(s.year===year || s.phase==='intake') {
      assert.ok(++guard<1400);
      if(audit) s=JSON.parse(JSON.stringify(s));
      if(audit && !['intake','build'].includes(s.phase))assert.deepEqual([...s.pile,...s.discard,...s.cards.map(c=>c.id)].sort((a,b)=>a-b),s.deck.slice().sort((a,b)=>a-b));
      if(s.report){assert.ok(G.acknowledge(s));continue;}
      const random=sample(s,guard);
      if(['shop','friendly','event'].includes(s.phase)&&s.day!==lastVisitDay){
        visits++;lastVisitDay=s.day;
      }
      switch(s.phase) {
        case 'build':{
          if(s.library.length>s.draft.length&&s.draft.length<16){
            assert.ok(G.D.toggle(s,s.library.find(c=>!s.draft.includes(c.id)).id));
          }
          assert.ok(G.lockDeck(s));break;
        }
        case 'mentor':
        case 'evolve':{
          const eligible=s.library.filter(c=>s.phase==='mentor'?c.k===s.visitor.k&&!c.mentor:!c.evolved&&c.effect!=='chain');
          assert.ok(G.teach(s,eligible[0].id));break;
        }
        case 'camp':assert.ok(G.campTrain(s,guided?best(s.cards.map(c=>G.skillOdds(s,c,true))):random));break;
        case 'practice': {
          const priorities=s.cards.map(c=>{
            const gain=G.gain(s,c)+(s.policy===c.k?1:0);
            const steps=movement?G.distance(s,c)*(movement==='short'?-100:100):0;
            return gain+steps;
          });
          const k=guided?best(priorities):random;
          practices++;
          assert.ok(G.practice(s,k));break;
        }
        case 'policy':assert.ok(G.choose(s,guided?best(s.options.map(o=>o.bonus+(o.k===1?1.5:0))):random));break;
        case 'skill':assert.ok(G.choose(s,guided?best(s.skillPool.map(o=>o.amount+(o.k===s.policy?0.5:0))):random));break;
        case 'match':
          if(s.match.finished)assert.ok(G.exitMatch(s));
          else assert.ok(G.play(s,guided?best([0,1,2].map(k=>G.odds(s,k))):random));
          break;
        case 'graduate':assert.ok(G.graduate(s,s.graduates[0]));break;
        case 'intake':sign();break;
        case 'shop':if(s.handSize<6&&G.expandHand(s))break;
          assert.ok(G.visitAction(s,!G.D.card(s,s.offers[random])&&s.cash>=G.price(s,random)?random:3));break;
        case 'event':assert.ok(G.visitAction(s,guided?1:random%2));break;
        case 'friendly':assert.ok(G.visitAction(s,guided?best([0,1,2].map(k=>G.friendlyOdds(s,k))):random));break;
        case 'prize':assert.ok(G.visitAction(s,s.offers.length?random%s.offers.length:3));break;
        default:throw Error(s.phase);
      }
    }
    while(true){
      const k=s.facility.indexOf(Math.min(...s.facility));
      if(!G.upgrade(s,k))break;
    }
    assert.ok(s.roster.length>=9 && s.roster.length<=18);
    assert.equal(new Set(s.roster.map(p=>p.id)).size,s.roster.length);
    assert.equal(new Set(s.roster.map(p=>p.slot)).size,9);
    assert.ok(s.roster.every(p=>p.stats.every(v=>Number.isFinite(v)&&v<=G.cap(s,p))));
    assert.equal(s.year,year+1);
    assert.ok(s.cash>=0 && s.drills.every(n=>n===0));
    assert.ok(s.points>=0 && s.logs.length<=36);
    history.push({practices,visits,rookies:rookies.length,high:rookies.filter(p=>['A','S','SS','Z'].includes(p.rank)).length,meanSkill:s.roster.filter(p=>p.grade>1).flatMap(p=>p.stats).reduce((a,b)=>a+b,0)/Math.max(1,9*s.roster.filter(p=>p.grade>1).length),title:s.titles>previous,lv:s.challenge,power:G.power(s)});
  }
  return history;
}
const runs=Number(process.argv[2]||1200),years=Number(process.argv[3]||12);
for(const [name,guided,challenge] of [['random',false,false],['guided',true,false],['challenge',true,true]]){
  const titles=Array(years).fill(0),power=Array(years).fill(0),lv=Array(years).fill(0),high=Array(years).fill(0),rookies=Array(years).fill(0);
  for(let i=0;i<runs;i++){
    const history=campaign((i+1)*971,years,guided,challenge,i===0);
    history.forEach((h,j)=>{titles[j]+=h.title;power[j]+=h.power;lv[j]+=h.lv;high[j]+=h.high;rookies[j]+=h.rookies;});
  }
  const summary=[...new Set([0,2,5,11,years-1])].filter(j=>j<years).map(j=>({year:j+1,AorHigherPct:+(100*high[j]/rookies[j]).toFixed(1),titlePct:+(100*titles[j]/runs).toFixed(1),afterRecruitPower:+(power[j]/runs).toFixed(1),league:+(lv[j]/runs).toFixed(1)}));
  console.log(name,JSON.stringify(summary));
}
console.log('Validated',runs*years*3,'seasons');
for(const movement of ['short','long']){
  const totals={title:0,practices:0,visits:0,power:0,meanSkill:0};
  for(let i=1;i<=runs;i++){
    const [year]=campaign(i*971,1,true,false,false,movement);
    for(const k of Object.keys(totals))totals[k]+=Number(year[k]);
  }
  console.log('First year',movement,JSON.stringify(Object.fromEntries(Object.entries(totals).map(([k,n])=>[k,+(n/runs).toFixed(3)]))));
}
const dynasty=campaign(13371337,100,true,true,true);
console.log('100-year school',JSON.stringify(dynasty.at(-1)));
