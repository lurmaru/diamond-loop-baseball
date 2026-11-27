const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../engine.js');
const {D}=G;
function enrolled(seed=443){
  const s=G.initial(seed);while(G.flip(s)){}
  G.enroll(s,s.pack[0].id);return s;
}
const playing=enrolled;
const ids=s=>[...s.cards.map(c=>c.id),...s.pile,...s.discard].sort((a,b)=>a-b);
test('spring edit persists, rejects an undersized deck and cannot reopen during practice',()=>{
  let s=enrolled();s.phase='graduate';assert.ok(G.graduate(s));
  while(G.flip(s)){}G.enroll(s,s.pack[0].id);assert.equal(s.phase,'build');
  assert.ok(D.toggle(s,0));assert.equal(G.lockDeck(s),false);
  s=JSON.parse(JSON.stringify(s));assert.ok(D.toggle(s,13));assert.ok(G.lockDeck(s));
  assert.equal(s.cards.length,4);assert.equal(D.toggle(s,13),false);
  assert.deepEqual(ids(s),s.deck.slice().sort((a,b)=>a-b));
});
test('only the played slot is replaced, including through discard shuffles and reloads',()=>{
  let s=playing();
  for(let i=0;i<100;i++){
    const j=i%4,before=s.cards.map(c=>c.id);
    D.spend(s,j,()=>0.387);
    assert.notEqual(before[j],s.cards[j].id);
    before.forEach((id,n)=>{if(n!==j)assert.equal(s.cards[n].id,id);});
    assert.deepEqual(ids(s),s.deck.slice().sort((a,b)=>a-b));
    s=JSON.parse(JSON.stringify(s));
  }
});
test('only the summer result opens the second deck edit; autumn decides whether March has matches',()=>{
  for(const win of [true,false]){
    const s=playing();
    s.phase='match';s.match={competition:'summer',round:3,finished:true,us:0,them:1};
    assert.ok(G.exitMatch(s));assert.equal(s.buildWindow,'summer');G.lockDeck(s);
    s.day=G.Y.events.autumn;s.phase='match';s.match={competition:'autumn',round:0,finished:true,us:+win,them:+!win};
    G.exitMatch(s);assert.equal(s.phase,'practice');assert.equal(s.qualified,win);
    s.day=G.Y.events.spring-1;s.cards[0].steps=2;
    assert.ok(G.practice(s,0));assert.equal(s.phase,win?'match':'practice');
    if(win){
      assert.equal(s.match.competition,'spring');G.acknowledge(s);
      Object.assign(s.match,{finished:true,us:1,them:0});G.exitMatch(s);
      assert.equal(s.match.round,1);
      Object.assign(s.match,{finished:true,us:0,them:1});G.exitMatch(s);
      assert.equal(s.phase,'practice');
    }
  }
});
test('ordinary practice cannot roll traits; a camp roll uses one card and rewards only its trainee',()=>{
  let successes=0;
  for(let i=1;i<=240;i++){
    const s=playing(i*831),before=s.roster.map(p=>p.traits.slice());
    s.day=G.Y.events.summerCamp-1;G.practice(s,0);
    assert.equal(s.phase,'camp');assert.deepEqual(s.roster.map(p=>p.traits),before);
    G.acknowledge(s);const k=s.cards[0].k,holder=s.focus;
    G.campTrain(s,0);assert.ok(s.report);assert.equal(G.campTrain(s,0),false);
    let added=0;
    s.roster.forEach((p,j)=>p.traits.forEach((v,n)=>{const d=v-before[j][n];if(d){assert.equal(p.id,holder);assert.equal(k,n);added+=d;}}));
    assert.ok([0,1].includes(added));successes+=added;
  }
  assert.ok(successes>55&&successes<145);
});
test('an actual graduate returns; a signed card and an evolution survive reshuffle and reload',()=>{
  let s=playing();
  const senior=s.roster[0];senior.grade=3;senior.traits=[0,4,0];
  s.phase='graduate';s.graduates=[senior.id];G.graduate(s,senior.id);
  while(G.flip(s)){}G.enroll(s,s.pack[0].id);G.lockDeck(s);
  s.day=G.Y.events.alumni-1;G.practice(s,0);G.acknowledge(s);assert.equal(s.phase,'mentor');
  assert.equal(s.visitor.id,senior.id);assert.ok(G.teach(s,13));
  assert.equal(G.teach(s,13),false);
  s=JSON.parse(JSON.stringify(s));const c=D.card(s,13);
  assert.equal(c.mentor,senior.name);assert.equal(G.skillOdds(s,c,true),0.65);assert.equal(G.skillOdds(s,c,false),0.2);
  assert.equal(G.trainingTarget(s,c).slot,1);assert.equal(G.skillName(c),'好リード');
  s.phase='evolve';assert.ok(G.teach(s,13));s.lastKind=0;
  const combo=G.gain(s,c);s.lastKind=2;assert.equal(combo-G.gain(s,c),2);
  s.phase='evolve';assert.equal(G.teach(s,13),false);
});
test('winter rumor changes both freshman position and rank probabilities, then expires',()=>{
  const tally={plain:[0,0],rumor:[0,0]};
  for(let seed=1;seed<=600;seed++)for(const mode of ['plain','rumor']){
    const s=playing(seed*7411);s.year=1;s.rumor=mode==='rumor'?1:null;
    s.phase='graduate';G.graduate(s);
    const p=s.pack.find(v=>v.slot===1);
    if(p){tally[mode][0]++;if(['A','S','SS','Z'].includes(p.rank))tally[mode][1]++;}
    while(G.flip(s)){}G.enroll(s,s.pack[0].id);assert.equal(s.rumor,null);
  }
  assert.ok(tally.rumor[0]>300&&tally.plain[0]===0);
  assert.ok(tally.rumor[1]/tally.rumor[0]>0.16);
});
