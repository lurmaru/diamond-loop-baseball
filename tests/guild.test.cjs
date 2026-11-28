const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../guild-engine.js');
const {campaign}=require('./guild-simulation.cjs');
const clone=s=>JSON.parse(JSON.stringify(s));
function guild(seed=42){
  const s=G.initial(seed);assert.ok(G.reveal(s,true));assert.ok(G.accept(s,s.pack[0].id));return s;
}
function arrive(s,event,k=0){
  s.day=G.Y.events[event]-1;
  if(event==='spring'){s.qualified=true;s.tiles[G.Y.events.spring]='spring';}
  assert.ok(G.train(s,k));if(s.notice)G.acknowledge(s);
}
function expedition(type='summer'){
  const s=guild();arrive(s,type);assert.equal(s.phase,'prepare');assert.ok(G.launch(s));return s;
}
function units(p,k){return p.stats[k]*100+p.xp[k];}
test('signed recruits keep their professions, distinct names and gacha result on reload',()=>{
  const s=G.initial(199),t=G.initial(199);assert.deepEqual(t,s);
  assert.equal(G.accept(s,s.pack[0].id),false);
  assert.ok(G.reveal(s));const resumed=clone(s);
  assert.ok(G.reveal(resumed,true));assert.ok(G.accept(resumed,resumed.pack[0].id));
  assert.equal(new Set(resumed.roster.map(p=>p.role%3)).size,3);
  assert.equal(new Set(resumed.roster.map(p=>p.name)).size,3);
  assert.equal(resumed.party.length,3);assert.equal(resumed.cards.length,4);
  for(const p of resumed.roster)assert.deepEqual(p,s.pack.find(v=>v.id===p.id));
  assert.equal(G.accept(resumed,resumed.focus),false);
});
test('fewer remaining days at a gate award only those days and never miss the meeting',()=>{
  const s=guild();const c=s.cards[0];s.day=G.Y.events.policy-1;
  assert.equal(G.distance(s,c),1);
  const p=s.roster.find(v=>v.id!==s.focus&&v.role%3!==c.k);
  const old=units(p,c.k),expected=Math.round(10*G.credit(s,c));
  assert.ok(G.train(s,0));assert.equal(s.phase,'oath');
  assert.equal(units(p,c.k)-old,expected);assert.deepEqual(s.roster.flatMap(p=>p.arts),Array(9).fill(0));
  if(s.notice)G.acknowledge(s);
  const k=s.blessings.indexOf('wealth'),gold=s.gold;
  assert.ok(G.chooseOath(s,k));assert.equal(s.mastery[k],1);assert.equal(s.gold,gold+14);
});
test('a permanent hand slot, purchased card and mentor signature survive the summer edit',()=>{
  const s=guild();s.phase='shop';s.gold=100;s.offers=[24];
  assert.ok(G.visit(s,4));assert.equal(s.handSize,5);assert.equal(s.cards.length,5);
  assert.ok(G.visit(s,0));assert.equal(G.visit(s,0),false);assert.equal(s.deck.includes(24),false);
  assert.ok(G.visit(s,3));s.phase='mentor';s.teacher={name:'ユナ',k:0};
  assert.ok(G.teach(s,24));G.acknowledge(s);
  G.D.begin(s,'summer');assert.ok(G.toggle(s,24));assert.ok(G.lock(s));
  const resumed=clone(s);assert.equal(G.D.card(resumed,24).mentor,'ユナ');assert.ok(resumed.deck.includes(24));
  assert.equal(resumed.cards.length,5);
});
test('a camp or shrine can teach an art, and a mentor increases the actual teaching range',()=>{
  function scenario(camp,mentor,seed){
    const s=guild();const p=s.roster.find(p=>p.id===s.focus),card=s.cards[0];s.rng=seed;
    if(mentor){G.D.card(s,card.id).mentor='先達';card.mentor='先達';}
    s.phase=camp?'camp':'event';s.eventCard=card.id;
    assert.ok(camp?G.camp(s,0):G.visit(s,1));
    return p.arts[card.k];
  }
  // First roll with these seeds falls strictly between the two rates.
  assert.equal(scenario(true,false,800),0);assert.equal(scenario(true,true,800),1);
  assert.equal(scenario(false,false,2350),0);assert.equal(scenario(false,true,2350),1);
});
test('intents, party jobs, mana, barriers and defensive stance change actual combat outcomes',()=>{
  const base=expedition();let e=base.expedition;e.intent=0;e.hp=e.maxHP=100;e.enemyHP=e.enemyMax=100;e.mp=3;
  const strike=clone(base),guard=clone(base);
  assert.ok(G.strike(strike,0));assert.ok(G.strike(guard,2));
  assert.ok(guard.expedition.hp>strike.expedition.hp);assert.equal(guard.expedition.open,true);
  assert.equal(guard.expedition.mp,5);
  const shield=clone(base),opening=clone(base);shield.expedition.intent=1;opening.expedition.intent=2;
  G.strike(shield,0);G.strike(opening,0);
  assert.ok(shield.expedition.enemyHP>opening.expedition.enemyHP);
  const mage=clone(base),other=clone(base);mage.roster[0].role=1;other.roster[0].role=7;
  G.strike(mage,1);G.strike(other,1);assert.equal(other.expedition.enemyHP-mage.expedition.enemyHP,3);
  base.expedition.mp=1;const before=clone(base);assert.equal(G.strike(base,1),false);assert.deepEqual(base,before);
  assert.equal(G.setParty(base,base.party[1],0),false);
});
test('reserve changes in preparation affect the team, tactical XP and a relic are claimed just once',()=>{
  const s=guild();arrive(s,'summer');
  s.roster.push({...clone(s.roster[0]),id:99,name:'コハク'});const reserve=s.party[0];
  assert.ok(G.setParty(s,99,0));assert.ok(G.launch(s));s.expedition.enemyHP=1;
  const before=clone(s);assert.ok(G.strike(s,0));
  assert.equal(s.phase,'result');assert.equal(s.wins,1);
  for(const p of s.roster){const old=before.roster.find(v=>v.id===p.id);
    assert.equal(units(p,0)-units(old,0),p.id===reserve?0:120);}
  const resumed=clone(s);assert.equal(G.strike(resumed,0),false);
  const e=resumed.expedition;e.hp=1;
  assert.ok(G.advance(resumed,e.rewards.indexOf(1)));assert.equal(e.floor,1);assert.ok(e.hp>1);
  assert.equal(G.advance(resumed,0),false);assert.deepEqual(resumed.roster,s.roster);
});
test('an inherited combo art strengthens a counter and lantern purchases carry into combat',()=>{
  const s=guild();s.phase='shop';s.gold=99;
  assert.equal(G.visit(s,5),false);s.gold++;assert.ok(G.visit(s,5));assert.equal(s.gold,0);
  assert.equal(G.lanternPrice(s),140);assert.ok(G.visit(s,3));arrive(s,'summer');
  const plain=clone(s);plain.lantern=0;G.launch(plain);G.launch(s);
  assert.equal(s.expedition.maxHP,plain.expedition.maxHP+2);
  s.expedition.intent=0;const trained=clone(s);
  trained.roster.find(p=>p.id===trained.party[0]).arts[2]=1;
  G.strike(s,2);G.strike(trained,2);
  assert.ok(trained.expedition.enemyHP<=s.expedition.enemyHP-2);
});
test('losing the gate closes spring, a win unlocks it, and summer alone opens the summer edit',()=>{
  for(const won of [false,true]){
    const s=expedition('autumn'),e=s.expedition;
    if(won)e.enemyHP=1;else{e.hp=1;e.enemyHP=999;}
    G.strike(s,0);assert.equal(e.won,won);assert.ok(G.advance(s,0));
    assert.equal(s.phase,'practice');assert.equal(s.qualified,won);
    assert.equal(s.tiles[G.Y.events.spring],won?'spring':'plain');
  }
  const s=expedition();s.expedition.hp=1;s.expedition.enemyHP=999;G.strike(s,0);G.advance(s,0);
  assert.equal(s.phase,'build');assert.equal(s.buildWindow,'summer');
});
test('a completed expedition unlocks the next depth and pays once',()=>{
  const s=expedition('spring');s.expedition.floor=1;s.expedition.enemyHP=1;G.strike(s,0);
  assert.equal(s.crowns,1);assert.equal(G.depth(s,1),false);
  G.advance(s,0);assert.ok(G.depth(s,1));assert.equal(G.depth(s,2),false);assert.equal(s.crowns,1);
});
test('third-year adventurers establish a legacy and the heir keeps its art after a reload',()=>{
  const s=guild();s.year=3;s.phase='succession';s.roster[0].arts[2]=5;const old=s.roster[0];
  assert.equal(G.succession(s,1234),false);assert.ok(G.succession(s,old.id));assert.equal(s.year,4);
  assert.equal(s.veterans.length,3);assert.equal(s.heir.level,3);
  const t=clone(s);G.reveal(t,true);const heir=t.pack[1];assert.ok(G.accept(t,heir.id));
  assert.equal(heir.arts[2],3);assert.equal(t.buildWindow,'spring');assert.ok(G.lock(t));
  arrive(t,'alumni');assert.equal(t.phase,'mentor');assert.ok(t.veterans.some(v=>v.name===t.teacher.name));
});
test('the calendar and combat remain deterministic across a multigeneration campaign',()=>{
  const a=campaign(7123,8,true),b=campaign(7123,8,true);
  assert.deepEqual(a.state,b.state);assert.equal(a.state.year,9);
  assert.ok(a.rooms>20);assert.ok(a.state.facility.some(v=>v>0));assert.ok(a.state.veterans.length>0);
});
test('reserves fill departing party slots before the next contract is signed',()=>{
  const s=guild();s.year=3;s.phase='succession';
  const reserves=s.roster.map(p=>({...clone(p),id:p.id+20,year:2}));
  s.roster.push(...reserves);G.succession(s,s.party[0]);
  assert.deepEqual(s.party,reserves.map(p=>p.id));
  assert.ok(G.setParty(s,reserves[2].id,0));G.reveal(s,true);G.accept(s,s.pack[1].id);
  assert.equal(s.party.length,3);assert.equal(new Set(s.party).size,3);
});
