const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../engine.js');
function school(seed=8317){
  const s=G.initial(seed);
  while(G.flip(s)){}
  G.enroll(s,s.pack[0].id);
  return s;
}
const units=(p,k)=>120*p.stats[k]+p.xp[k];

test('every date in the school year exists exactly once, with real month boundaries and protected competitions',()=>{
  const s=school();
  const labels=s.tiles.map((_,day)=>G.date(day));
  assert.equal(labels.length,365);assert.equal(new Set(labels).size,365);
  for(const [n,label] of [[0,'4月1日'],[29,'4月30日'],[30,'5月1日'],[274,'12月31日'],[275,'1月1日'],[333,'2月28日'],[334,'3月1日'],[364,'3月31日']])assert.equal(labels[n],label);
  for(const [key,day] of Object.entries(G.Y.events)){
    if(key==='spring')continue;
    s.day=day-1;assert.equal(G.landing(s,{steps:3}),day);
  }
  s.day=333;s.qualified=false;assert.equal(G.landing(s,{steps:3}),336);
  s.qualified=true;assert.equal(G.landing(s,{steps:3}),334);
});

test('three continuous days earn 30% more base practice credit than the same drill for three single days',()=>{
  function train(days){
    const s=school();s.day=78;
    const p=s.roster[1];p.genius=false;p.stats[0]=20;
    const start=units(p,0);
    for(const steps of days){
      Object.assign(s.cards[0],{k:0,id:0,effect:'',steps,tier:0});
      s.tiles[s.day+steps]='plain';
      assert.ok(G.practice(s,0));G.acknowledge(s);
    }
    return {credit:units(p,0)-start,day:s.day};
  }
  assert.deepEqual(train([1,1,1]),{credit:60,day:81});
  assert.deepEqual(train([3]),{credit:78,day:81});
});

test('each new skill changes its associated tactic; a player can develop a different specialty than their teammates',()=>{
  const s=school();s.phase='match';s.match={level:55,scene:0};
  for(let k=3;k<9;k++){
    const a=structuredClone(s),tactic=k%3,odds=G.odds(a,tactic);
    a.roster.forEach(p=>p.stats[k]+=15);
    assert.ok(G.odds(a,tactic)>odds);
  }
  s.phase='practice';s.day=75;
  const a=s.roster[1],b=s.roster[2];
  for(const p of [a,b]){p.genius=false;p.stats[5]=20;}
  assert.equal(G.setIndividual(s,a.id,2),false);
  assert.ok(G.setIndividual(s,a.id,5));assert.ok(G.setIndividual(s,b.id,6));
  Object.assign(s.cards[0],G.D.make(0),{steps:3});
  G.practice(s,0);assert.ok(units(a,5)>units(b,5));
  assert.equal(JSON.parse(JSON.stringify(s)).roster[1].individual,5);
});

test('personal training, camp coaching, and monthly support have distinct effects and persist through graduation',()=>{
  const a=school(),b=structuredClone(a);b.points=20;
  for(const k of [3,4,5])assert.ok(G.upgrade(b,k));
  assert.equal(b.points,8);
  const data=[];
  for(const s of [a,b]){
    s.day=29;const p=s.roster[1];G.setIndividual(s,p.id,5);p.stats[5]=20;
    Object.assign(s.cards[0],G.D.make(0));const before=units(p,5);
    G.practice(s,0);data.push(units(p,5)-before);
  }
  assert.ok(data[1]>data[0]);assert.equal(b.cash-a.cash,3);
  assert.ok(G.skillOdds(b,b.cards[0],true)>G.skillOdds(a,a.cards[0],true));
  assert.equal(G.skillOdds(b,b.cards[0],false),G.skillOdds(a,a.cards[0],false));
  const money=b.cash;b.phase='graduate';b.report=null;
  G.graduate(b);assert.equal(b.cash-money,3);assert.deepEqual(b.facility.slice(3),[1,1,1]);
});

test('rarity changes both printed training and appearances, and a victory can award the last missing rare card',()=>{
  const s=school(),D=G.D;
  assert.deepEqual([0,9,21].map(id=>D.rarity(D.make(id))),['N','R','SR']);
  let seed=904,rareOffers=0;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<1500;i++){
    const offer=D.offers(s,random);
    if(offer.some(id=>D.rarity(D.make(id))==='SR'))rareOffers++;
    assert.equal(new Set(offer).size,offer.length);
  }
  assert.ok(rareOffers>180&&rareOffers<350);
  for(let id=15;id<26;id++)D.acquire(s,id);
  assert.deepEqual(D.offers(s,()=>.99,true),[26]);
  assert.deepEqual(D.offers(s,()=>.99),[]);
});

test('the previous public release resumes its unfinished autumn final with the existing hand, roster, RNG and trained stats',()=>{
  const old=require('./v4-autumn-save.json'),s=G.migrate(structuredClone(old));
  assert.equal(s.day,183);assert.equal(s.phase,'match');assert.equal(s.version,5);
  for(const field of ['year','rng','match','deck','cards','pile','discard','cash','points','logs'])assert.deepEqual(s[field],old[field]);
  assert.deepEqual(s.facility,[1,2,1,0,0,0]);
  for(const [i,p] of s.roster.entries()){
    assert.deepEqual(p.stats.slice(0,3),old.roster[i].stats);assert.equal(p.stats.length,9);
    assert.equal(p.xp.length,9);assert.ok(p.stats.every(v=>v<=G.cap(s,p)));
  }
  while(!s.match.finished)assert.ok(G.play(s,1));
  const win=s.match.us>s.match.them;
  assert.ok(G.exitMatch(s));assert.equal(s.tiles[334],win?'spring':'plain');
  assert.deepEqual(G.migrate(structuredClone(s)),s);
});

test('delegated practice plays the same cards as manual practice and pauses on the exact event day',()=>{
  const a=school(),b=structuredClone(a);
  a.day=b.day=G.Y.events.summerCamp-4;
  for(const s of [a,b])s.tiles.fill('plain',s.day+1,G.Y.events.summerCamp);
  assert.ok(G.autoPractice(a));
  while(b.phase==='practice'&&!b.report&&b.day<a.day){
    const score=b.cards.map(c=>G.gain(b,c)+(c.k===b.policy?2:0));
    G.practice(b,score.indexOf(Math.max(...score)));
    if(b.report.type==='practice')G.acknowledge(b);
  }
  assert.deepEqual(a,b);assert.equal(a.phase,'camp');assert.equal(a.day,G.Y.events.summerCamp);
  assert.equal(G.autoPractice(a),false);
});
