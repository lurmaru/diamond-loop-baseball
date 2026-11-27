const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../engine.js');

function school(seed){
  const s=G.initial(seed);
  while(G.flip(s)){}
  G.enroll(s,s.pack[0].id);
  return s;
}

test('the actual first release save migrates once, preserving the roster, hand and progress',()=>{
  const old=require('./legacy-save.json');
  const s=G.migrate(structuredClone(old));
  assert.equal(s.day,3);assert.equal(s.year,old.year);assert.equal(s.phase,old.phase);
  assert.deepEqual(s.cards.map(c=>c.name),old.cards.map(c=>c.name));
  assert.deepEqual(s.roster.map(p=>[p.id,p.stats,p.grade,p.traits]),old.roster.map(p=>[p.id,p.stats,p.grade,p.traits]));
  assert.deepEqual(s.mastery,old.mastery);
  const snapshot=structuredClone(s);
  assert.deepEqual(G.migrate(s),snapshot);
  assert.ok(G.practice(s,0));assert.ok(s.day>3);
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
  const c=s.cards.find(c=>c.steps===2);
  const money=s.cash;
  assert.ok(G.practice(s,s.cards.indexOf(c)));
  assert.equal(s.day,2);assert.equal(s.phase,'shop');
  assert.equal(s.cash,money+2);
  G.acknowledge(s);
  assert.ok(G.visitAction(s,3));
  assert.ok(s.cards.every(c=>G.landing(s,c)===3));
  assert.deepEqual(s.cards.map(c=>c.steps).sort(),[1,2,3]);
});

test('good and adverse squares alter the cash outcome on arrival',()=>{
  for(const [day,delta] of [[0,5],[5,-3]]){
    const s=school(123);
    s.day=day;
    const old=s.cash;
    assert.ok(G.practice(s,s.cards.findIndex(c=>c.steps===1)));
    assert.equal(s.day,day+1);assert.equal(s.cash-old,delta);
  }
});

test('purchased training bonuses apply to future cards, and each shop tracks sold stock',()=>{
  const s=school(36);
  s.phase='shop';s.visit={sold:[false,false,false]};
  const card={k:2,tier:0,steps:1},before=G.gain(s,card);
  s.cash=9;assert.equal(G.visitAction(s,2),false);
  s.cash=20;assert.ok(G.visitAction(s,2));
  assert.equal(s.cash,10);assert.equal(G.gain(s,card),before+1);
  assert.equal(G.visitAction(s,2),false);
  assert.ok(G.visitAction(s,0));assert.ok(G.visitAction(s,3));
  assert.equal(s.phase,'practice');
});

test('exhibition wins grant one selectable upgrade, losses grant participation money',()=>{
  const outcomes=new Set();
  for(let i=0;i<100;i++){
    const s=school(i*971);
    s.phase='friendly';s.visit={k:0,level:42};
    assert.ok(G.visitAction(s,1));outcomes.add(s.phase);
    if(s.phase==='prize'){
      assert.equal(s.cash,20);const saved=JSON.parse(JSON.stringify(s));
      assert.ok(G.visitAction(saved,2));assert.equal(saved.drills[2],1);
      assert.equal(G.visitAction(saved,2),false);
    }else assert.equal(s.cash,14);
  }
  assert.deepEqual([...outcomes].sort(),['practice','prize']);
});

test('OB events allow money or seasonal development; permanent facilities survive promotion',()=>{
  const a=school(133);a.phase='event';a.visit={k:1};
  const b=structuredClone(a);
  assert.ok(G.visitAction(a,0));assert.equal(a.cash,22);
  assert.ok(G.visitAction(b,1));assert.equal(b.drills[1],1);
  b.facility[1]=2;b.phase='graduate';
  assert.ok(G.graduate(b));assert.deepEqual(b.drills,[0,0,0]);
  assert.equal(b.facility[1],2);assert.equal(b.roster.length,9);
  assert.equal(b.pack.length,3);assert.ok(b.roster.every(p=>p.grade===2));
});
