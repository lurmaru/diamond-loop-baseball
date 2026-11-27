const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../engine.js');

function school(seed){
  const s=G.initial(seed);
  while(G.flip(s)){}
  assert.ok(G.enroll(s,s.pack[0].id));
  assert.equal(s.phase,'practice');return s;
}
test('independent campaigns are reproducible and retain nine positions',()=>{
  const a=G.initial(971),b=G.initial(971);
  assert.deepEqual(a,b);
  assert.equal(a.phase,'intake');assert.equal(a.roster.length,0);
  assert.equal(new Set(a.pack.map(p=>p.slot)).size,9);
  assert.equal(G.enroll(a,a.pack[0].id),false);
  assert.ok(a.pack.every(p=>p.grade===1));
  assert.ok(G.flip(a));assert.equal(a.drawn,1);
  const saved=JSON.parse(JSON.stringify(a));while(G.flip(saved)){}
  assert.ok(G.enroll(saved,saved.pack[3].id));assert.equal(saved.roster.length,9);
  assert.equal(G.enroll(saved,saved.focus),false);
});
test('training honors the cap and a pending reward consumes exactly one turn',()=>{
  const s=school(4);
  s.cards[0]={...s.cards[0],k:0,steps:3,tier:0,name:'打撃練習'};
  s.day=G.Y.events.policy-3;
  s.roster.forEach(p=>{p.stats[0]=G.cap(s,p)-1;p.xp[0]=100;});
  assert.ok(G.practice(s,0));
  assert.deepEqual(s.roster.map(p=>p.stats[0]),s.roster.map(p=>G.cap(s,p)));
  assert.equal(G.practice(s,0),false);
  assert.equal(G.choose(s,1),false);
  assert.equal(s.week,1);
  assert.ok(G.acknowledge(s));
  assert.ok(G.choose(s,1));
  assert.equal(s.mastery[1],1);
  assert.ok(G.gain(s,{k:1,steps:2,tier:0})>3);
});
test('facilities charge exact costs and respect available points',()=>{
  const s=school(2);
  assert.equal(G.upgrade(s,0),false);
  s.points=4;
  assert.ok(G.upgrade(s,2));
  assert.equal(s.points,0);
  assert.equal(G.limitBonus(s),4);
  assert.equal(G.cost(s,2),7);
});
test('the focused player receives extra practice',()=>{
  const s=school(77);
  s.roster.forEach(p=>{p.genius=false;p.stats[2]=20;});
  assert.ok(G.setFocus(s,s.roster[8].id));
  s.cards[2].k=2;const steps=G.distance(s,s.cards[2]);assert.ok(G.practice(s,2));
  const units=p=>120*p.stats[2]+p.xp[2];
  assert.ok(units(s.roster[8])>=units(s.roster[0])+10*steps);
});
test('targeted special abilities unlock a team combination',()=>{
  const s=school(12);
  s.roster.forEach(p=>p.traits=[0,0,0]);
  s.roster[0].traits[1]=2;s.roster[4].traits[2]=1;
  s.phase='match';s.match={level:50,scene:1};
  const before=G.odds(s,1);
  assert.equal(G.synergy(s,1).active,false);
  s.roster[4].traits[2]++;
  assert.equal(G.synergy(s,1).active,true);
  assert.ok(G.odds(s,1)>before);
});
test('match results and points cannot be claimed twice',()=>{
  const s=school(11);
  s.phase='match';s.match={round:3,opp:'試験校',level:65,us:14,them:0,step:2,scene:0,plays:[],finished:false};
  assert.ok(G.play(s,2));assert.equal(s.titles,1);assert.equal(s.record,1);
  const score=s.points;
  assert.equal(G.play(s,2),false);assert.equal(s.points,score);
  assert.ok(G.exitMatch(s));assert.equal(G.exitMatch(s),false);
});
function matchSchool(competition,lead){
  const s=school(501);
  for(const p of s.roster){
    p.rank='B';p.stats.fill(40);p.xp.fill(0);
  }
  s.phase='match';
  s.match={competition,round:0,opp:'試験校',level:55,us:Math.max(0,lead),
    them:Math.max(0,-lead),step:0,scene:0,plays:[],finished:false};
  return s;
}
test('official wins and losses share experience by tactic once at full time',()=>{
  for(const competition of ['summer','autumn','spring']){
    for(const lead of [-20,20]){
      let s=matchSchool(competition,lead);
      const initial=structuredClone(s.roster);
      assert.ok(G.play(s,0));assert.ok(G.play(s,1));
      assert.deepEqual(s.roster,initial);
      s=G.migrate(JSON.parse(JSON.stringify(s)));
      assert.ok(G.play(s,0));assert.ok(s.match.finished);
      assert.equal(s.match.us>s.match.them,lead>0);
      for(const [i,p] of s.roster.entries()){
        assert.deepEqual(p.xp,[80,40,0,40,20,0,0,0,0]);
        assert.deepEqual(p.traits,initial[i].traits);
      }
      assert.match(s.logs[0].detail,/打撃・長打力 ／ 投球・制球力の実戦経験/);
      const roster=structuredClone(s.roster);
      s=G.migrate(JSON.parse(JSON.stringify(s)));
      assert.equal(G.play(s,2),false);assert.ok(G.exitMatch(s));
      assert.deepEqual(s.roster,roster);
    }
  }
});
test('extra innings redistribute the fixed pool and respect existing XP and caps',()=>{
  const s=matchSchool('summer',0);
  assert.ok(G.play(s,0));assert.ok(G.play(s,0));
  const preview=structuredClone(s);
  assert.ok(G.play(preview,0));
  const ninth=preview.match.plays.at(-1);
  s.match.us=10+ninth.against;s.match.them=10+ninth.runs;
  const p=s.roster[0],capped=s.roster[1];
  capped.stats.fill(G.cap(s,capped));p.xp.fill(115);
  const before=structuredClone(s.roster);
  assert.ok(G.play(s,0));assert.ok(s.match.extra);assert.equal(s.match.finished,false);
  assert.deepEqual(s.roster,before);
  while(!s.match.finished)assert.ok(G.play(s,2));
  const units=player=>player.stats.map((v,i)=>v*120+player.xp[i]);
  const delta=units(p).map((v,i)=>v-units(before[0])[i]);
  assert.equal(delta.reduce((a,b)=>a+b,0),180);
  assert.ok(delta[0]>0 && delta[2]>0);
  assert.equal(delta[0],2*delta[3]);assert.equal(delta[2],2*delta[8]);
  assert.deepEqual(capped,before[1]);
  assert.match(s.logs[0].detail,/1人の能力が上昇/);
});
test('friendly win and loss earn one sixth of official XP, independent of the prize',()=>{
  for(const won of [false,true]){
    const s=matchSchool('summer',0);
    s.phase='friendly';s.match=null;s.visit={k:2,opp:'試験校',level:40};
    s.rng=won?0:1800;
    assert.equal(G.visitAction(s,3),false);
    assert.ok(G.visitAction(s,2));
    assert.equal(s.phase,won?'prize':'practice');
    for(const p of s.roster)assert.deepEqual(p.xp,[0,0,20,0,0,0,0,0,10]);
    assert.match(s.lastStop,/守備・肩力の実戦経験/);
    assert.match(s.logs[0].detail,/守備・肩力の実戦経験/);
    const saved=G.migrate(JSON.parse(JSON.stringify(s)));
    const roster=structuredClone(saved.roster);
    if(won)assert.ok(G.visitAction(saved,3));
    assert.equal(G.visitAction(saved,2),false);
    assert.deepEqual(saved.roster,roster);
  }
});
test('inherited skills survive a saved recruitment screen',()=>{
  let s=school(132);
  s.roster.forEach(p=>p.grade=3);const senior=s.roster[0];
  senior.traits=[0,5,0];
  s.phase='graduate';s.graduates=s.roster.filter(p=>p.grade===3).map(p=>p.id);
  assert.ok(G.graduate(s,senior.id));
  s=JSON.parse(JSON.stringify(s));
  while(G.flip(s)){}const rookie=s.pack[1],level=rookie.traits[1];
  assert.ok(G.enroll(s,rookie.id));
  assert.equal(rookie.traits[1],level+3);
  assert.equal(s.focus,rookie.id);assert.equal(s.roster.length,9);
  assert.equal(s.year,2);assert.equal(s.points,3);
  assert.equal(G.recruit(s,1),false);
});
test('challenge can be changed before the tournament only, within unlocked levels',()=>{
  const s=school(222);
  assert.equal(G.setChallenge(s,1),false);
  s.year=3;assert.ok(G.setChallenge(s,1));assert.equal(G.setChallenge(s,2),false);
  s.record=3;assert.ok(G.setChallenge(s,3));
  s.day=G.Y.events.summer;assert.equal(G.setChallenge(s,0),false);
});
