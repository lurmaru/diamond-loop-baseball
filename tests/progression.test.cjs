const {test}=require('node:test');
const assert=require('node:assert/strict');
const G=require('../engine.js');

function openSchool(seed){
  const s=G.initial(seed);
  while(G.flip(s)){}
  assert.ok(G.enroll(s,s.pack[0].id));
  return s;
}

test('every new school receives the same 12 cards, already dealt in varying order',()=>{
  const hands=new Set();
  for(let seed=1;seed<=100;seed++){
    const s=openSchool(seed*7919);
    assert.equal(s.phase,'practice');
    assert.deepEqual(s.deck,Array.from({length:12},(_,i)=>i));
    assert.equal(s.cards.length,4);
    assert.equal(G.lockDeck(s),false);
    hands.add(s.cards.map(c=>c.id).join(','));
  }
  assert.ok(hands.size>90);
});

test('preview and applied ordinary growth follow actual distance in every season and at gates',()=>{
  for(const day of [0,6,11,18,32]){
    for(const steps of [1,2,3]){
      const s=openSchool(6743);
      s.day=day;s.qualified=day===32;
      const c=s.cards[0];
      Object.assign(c,{k:0,steps,tier:0,effect:''});
      const player=s.roster.find(p=>p.id!==s.focus);
      player.genius=false;player.stats[0]=20;
      const walked=[6,32].includes(day)?1:steps;
      assert.equal(G.gain(s,c),walked*2);
      assert.ok(G.practice(s,0));
      assert.equal(s.day-day,walked);
      assert.equal(player.stats[0]-20,walked*2);
    }
  }
});

test('all six potentials stop actual training at the player limit, and Z can grow past 10000',()=>{
  const s=openSchool(139);
  s.facility[2]=2;s.manuals=3;
  const ranks=['C','B','A','S','SS','Z'],bases=[58,86,122,174,250,Infinity];
  const players=s.roster.slice(0,ranks.length);
  players.forEach((p,i)=>{
    p.rank=ranks[i];p.genius=false;
    p.stats[0]=i===5?10000:bases[i]+10;
    assert.equal(G.cap(s,p),bases[i]+11);
  });
  Object.assign(s.cards[0],{k:0,tier:0,steps:3,effect:''});
  G.practice(s,0);
  players.forEach((p,i)=>assert.equal(p.stats[0],i===5?10006:bases[i]+11));
  const saved=JSON.parse(JSON.stringify(s));
  assert.equal(G.cap(saved,saved.roster[5]),Infinity);
});

test('a returning school retains previously trained stats and an unfinished inaugural draft',()=>{
  const s=openSchool(911);
  G.D.begin(s,'spring');G.D.toggle(s,0);G.D.toggle(s,14);
  s.version=3;s.facility[2]=2;s.manuals=3;
  const p=s.roster[1];p.rank='C';p.stats=[81,39,44];
  const draft=s.draft.slice();
  G.migrate(s);
  assert.deepEqual(p.stats,[81,39,44]);assert.equal(G.cap(s,p),81);
  assert.deepEqual(s.draft,draft);assert.equal(s.phase,'build');
  const copy=structuredClone(s);
  assert.deepEqual(G.migrate(copy),s);
  s.points=100;G.upgrade(s,2);assert.equal(G.cap(s,p),85);
  assert.ok(G.lockDeck(s));
  Object.assign(s.cards[0],{k:0,steps:3});
  G.practice(s,0);assert.equal(p.stats[0],85);
});

test('recruit quality grows with years, wins and scouting; rare ranks remain random',t=>{
  const cohorts=[[1,0,0],[10,0,0],[30,0,0],[30,110,5]];
  const summary=cohorts.map(([year,wins,network])=>{
    let high=0,total=0,sum=0;
    for(let seed=1;seed<=1500;seed++){
      const s=G.initial(seed*19531);
      if(year>1){
        s.phase='graduate';s.year=year-1;s.wins=wins;s.facility[1]=network;
        G.graduate(s);
      }
      for(const p of s.pack){
        total++;high+=['A','S','SS','Z'].includes(p.rank);
        sum+=p.stats.reduce((a,b)=>a+b,0)/3;
      }
    }
    return {year,wins,network,players:total,high:high/total,mean:sum/total};
  });
  summary.forEach((v,i)=>{
    if(i){assert.ok(v.high>summary[i-1].high+.008);assert.ok(v.mean>summary[i-1].mean+1);}
    assert.ok(v.high<.48 && v.high>.23);
    t.diagnostic(`year ${v.year}, wins ${v.wins}, scouting Lv.${v.network}: ${v.players} recruits, A+ ${(100*v.high).toFixed(1)}%, mean starting stat ${v.mean.toFixed(1)}`);
  });
});

test('qualitative scouting reports group materially different odds together',()=>{
  assert.deepEqual([.08,.29,.31,.43,.46,.67,.72,.92].map(G.outlook),
    ['厳しい','厳しい','慎重に','慎重に','いけそう','いけそう','有利','有利']);
});
