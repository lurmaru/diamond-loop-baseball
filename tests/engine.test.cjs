const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../engine.js');

function school(seed){
  const s=G.initial(seed);
  while(G.flip(s)){}
  assert.ok(G.enroll(s,s.pack[0].id));
  assert.ok(G.lockDeck(s));return s;
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
  s.roster.forEach(p=>p.stats[0]=G.cap(s)-1);
  assert.ok(G.practice(s,0));
  assert.deepEqual(s.roster.map(p=>p.stats[0]),Array(9).fill(G.cap(s)));
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
  assert.equal(G.cap(s),74);
  assert.equal(G.cost(s,2),7);
});
test('the focused player receives extra practice',()=>{
  const s=school(77);
  s.roster.forEach(p=>{p.genius=false;p.stats[2]=20;});
  assert.ok(G.setFocus(s,s.roster[8].id));
  s.cards[2].k=2;assert.ok(G.practice(s,2));
  assert.ok(s.roster[8].stats[2]>=s.roster[0].stats[2]+2);
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
  s.day=11;assert.equal(G.setChallenge(s,0),false);
});
