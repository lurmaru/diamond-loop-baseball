const assert = require('node:assert/strict');
const G = require('../engine.js');
const best = scores => scores.indexOf(Math.max(...scores));
const sample = (s, salt) => ((s.rng >>> 8) + salt) % 3;

function campaign(seed, years, guided, challenge, audit=false) {
  let s=G.initial(seed);
  const history=[];
  const sign=()=>{
    while(G.flip(s)){}
    const i=best(s.pack.map(p=>p.stats.reduce((a,b)=>a+b)+8*p.genius));
    assert.ok(G.enroll(s,s.pack[i].id));
  };
  sign();
  for (let year=1;year<=years;year++) {
    const previous=s.titles;
    let guard=0;
    if(challenge && year>=3) G.setChallenge(s,Math.max(1,s.record));
    while(s.year===year || s.phase==='intake') {
      assert.ok(++guard<250);
      if(audit) s=JSON.parse(JSON.stringify(s));
      if(s.report){assert.ok(G.acknowledge(s));continue;}
      const random=sample(s,guard);
      switch(s.phase) {
        case 'practice': {
          const k=guided?best(s.cards.map(c=>G.gain(s,c)+(s.policy===c.k?1:0))):random;
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
        case 'shop':assert.ok(G.visitAction(s,!s.visit.sold[random]&&s.cash>=G.price(s,random)?random:3));break;
        case 'event':assert.ok(G.visitAction(s,guided?1:random%2));break;
        case 'friendly':assert.ok(G.visitAction(s,guided?best([0,1,2].map(k=>G.friendlyOdds(s,k))):random));break;
        case 'prize':assert.ok(G.visitAction(s,guided&&s.policy>=0?s.policy:random));break;
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
    assert.ok(s.roster.every(p=>p.stats.every(v=>Number.isFinite(v)&&v<=G.cap(s))));
    assert.equal(s.year,year+1);
    assert.ok(s.cash>=0 && s.drills.every(n=>n===0));
    assert.ok(s.points>=0 && s.logs.length<=36);
    history.push({title:s.titles>previous,lv:s.challenge,power:G.power(s)});
  }
  return history;
}
const runs=Number(process.argv[2]||1200),years=12;
for(const [name,guided,challenge] of [['random',false,false],['guided',true,false],['challenge',true,true]]){
  const titles=Array(years).fill(0),power=Array(years).fill(0),lv=Array(years).fill(0);
  for(let i=0;i<runs;i++){
    const history=campaign((i+1)*971,years,guided,challenge,i===0);
    history.forEach((h,j)=>{titles[j]+=h.title;power[j]+=h.power;lv[j]+=h.lv;});
  }
  const summary=[0,2,5,11].map(j=>({year:j+1,titlePct:+(100*titles[j]/runs).toFixed(1),afterRecruitPower:+(power[j]/runs).toFixed(1),league:+(lv[j]/runs).toFixed(1)}));
  console.log(name,JSON.stringify(summary));
}
console.log('Validated',runs*years*3,'seasons');
