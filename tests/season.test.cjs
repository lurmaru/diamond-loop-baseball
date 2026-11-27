const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../engine.js');

function school(seed){
  const s=G.initial(seed);
  while(G.flip(s)){}
  G.enroll(s,s.pack[0].id);
  assert.equal(s.phase,'practice');return s;
}

test('the actual first release save migrates once, preserving the roster, hand and progress',()=>{
  const old=require('./legacy-save.json');
  const s=G.migrate(structuredClone(old));
  assert.equal(s.day,30);assert.equal(s.year,old.year);assert.equal(s.phase,old.phase);
  assert.deepEqual(s.cards.slice(0,old.cards.length).map(c=>c.name),old.cards.map(c=>c.name));
  assert.deepEqual(s.roster.map(p=>[p.id,p.stats.slice(0,3),p.grade,p.traits]),old.roster.map(p=>[p.id,p.stats,p.grade,p.traits]));
  assert.deepEqual(s.mastery,old.mastery);
  const snapshot=structuredClone(s);
  assert.deepEqual(G.migrate(s),snapshot);
  assert.ok(G.practice(s,0));assert.ok(s.day>30);
});

test('all six ranks and ten portraits occur and each opening pack has nine different faces',()=>{
  const ranks=new Set(),faces=new Set();
  for(let i=0;i<600;i++){
    const s=G.initial(i*5713);
    assert.equal(new Set(s.pack.map(p=>p.face)).size,9);
    for(const p of s.pack){
      ranks.add(p.rank);faces.add(p.face);
      assert.equal(p.genius,['S','SS','Z'].includes(p.rank));
    }
  }
  assert.deepEqual([...ranks].sort(),['A','B','C','S','SS','Z']);
  assert.equal(faces.size,10);
});

test('movement stops at gates; only the landing square acts and numbered cards vary',()=>{
  const s=school(78);
  const c=s.cards[0];c.steps=2;
  const money=s.cash;
  assert.ok(G.practice(s,s.cards.indexOf(c)));
  assert.equal(s.day,2);assert.equal(s.phase,'shop');
  assert.equal(s.cash,money);
  G.acknowledge(s);
  assert.ok(G.visitAction(s,3));
  s.day=G.Y.events.policy-1;
  assert.ok(s.cards.every(c=>G.landing(s,c)===G.Y.events.policy));
  assert.equal(s.cards.length,4);
});

test('good and adverse squares alter the cash outcome on arrival',()=>{
  for(const [day,delta] of [[0,2],[5,-2]]){
    const s=school(123);
    s.day=day;
    s.cards[0].steps=1;const old=s.cash;
    assert.ok(G.practice(s,s.cards.findIndex(c=>c.steps===1)));
    assert.equal(s.day,day+1);assert.equal(s.cash-old,delta);
  }
});

test('shop acquisitions stay in the notebook until a build, and each card can be bought once',()=>{
  const s=school(36);
  s.phase='shop';s.offers=[15,16,17];s.cash=9;
  assert.equal(G.visitAction(s,2),false);
  s.cash=G.price(s,2);assert.ok(G.visitAction(s,2));assert.equal(s.cash,0);
  assert.ok(G.D.card(s,17));assert.ok(!s.deck.includes(17));
  s.cash=100;assert.equal(G.visitAction(s,2),false);
  assert.ok(G.expandHand(s));assert.equal(s.handSize,5);assert.equal(s.cards.length,5);
  assert.ok(G.visitAction(s,3));
});

test('exhibition wins grant one selectable upgrade, losses grant participation money',()=>{
  const outcomes=new Set();
  for(let i=0;i<100;i++){
    const s=school(i*971);
    s.phase='friendly';s.visit={k:0,level:42};
    assert.ok(G.visitAction(s,1));outcomes.add(s.phase);
    if(s.phase==='prize'){
      assert.equal(s.cash,20);const saved=JSON.parse(JSON.stringify(s));
      assert.ok(G.visitAction(saved,2));assert.ok(G.D.card(saved,saved.offers[2]));
      assert.equal(G.visitAction(saved,2),false);
    }else assert.equal(s.cash,14);
  }
  assert.deepEqual([...outcomes].sort(),['practice','prize']);
});

test('Community events allow money or a skill lesson; permanent facilities survive promotion',()=>{
  const a=school(133);a.phase='event';a.visit={k:1};
  const b=structuredClone(a);
  assert.ok(G.visitAction(a,0));assert.equal(a.cash,22);
  assert.ok(G.visitAction(b,1));assert.ok(b.report);G.acknowledge(b);
  b.facility[1]=2;b.phase='graduate';
  assert.ok(G.graduate(b));assert.deepEqual(b.drills,[0,0,0]);
  assert.equal(b.facility[1],2);assert.equal(b.roster.length,9);
  assert.equal(b.pack.length,3);assert.ok(b.roster.every(p=>p.grade===2));
});
