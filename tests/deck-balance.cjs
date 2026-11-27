// Matched starting schools: three years, the same notebook, 24G discretionary
// funding and coaching policy. The larger hand pays the normal shop price.
const assert=require('node:assert/strict');
const G=require('../engine.js');
const count=Number(process.argv[2]||1000);
const best=scores=>scores.indexOf(Math.max(...scores));
function school(seed,width,hand){
  const s=G.initial(seed);
  while(G.flip(s)){}
  G.enroll(s,s.pack[0].id);G.D.acquire(s,15);
  const founders=new Set(s.roster.map(p=>p.id)),learned=new Set();
  // Controlled experiment: open an editing window for all three test cohorts.
  G.D.begin(s,'summer');
  s.draft=width===16?s.library.map(c=>c.id):[...s.draft.slice(0,11),13];
  G.lockDeck(s);s.cash+=24;
  if(hand===5){s.phase='shop';assert.ok(G.expandHand(s));s.phase='practice';}
  let camps=0,batteryReady=0,steps=0;
  while(s.year<=3){
    assert.ok(++steps<3000);
    if(s.report){G.acknowledge(s);continue;}
    switch(s.phase){
      case 'practice':{
        const score=s.cards.map(c=>G.gain(s,c)-(c.id===13?5:0));
        G.practice(s,best(score));break;
      }
      case 'camp':{
        camps++;batteryReady+=s.cards.some(c=>c.id===13);
        const i=best(s.cards.map(c=>G.skillOdds(s,c,true)+(c.id===13?.15:0)));
        const target=G.trainingTarget(s,s.cards[i]);
        G.campTrain(s,i);
        if(s.report.type==='talent'&&founders.has(target.id))learned.add(target.id);
        break;
      }
      case 'event':{
        const target=G.trainingTarget(s,G.D.card(s,s.eventCard));
        G.visitAction(s,1);
        if(s.report.type==='talent'&&founders.has(target.id))learned.add(target.id);
        break;
      }
      case 'evolve':G.teach(s,s.library.find(c=>!c.evolved&&c.effect!=='chain').id);break;
      case 'shop':case 'prize':G.visitAction(s,3);break;
      case 'friendly':G.visitAction(s,best([0,1,2].map(k=>G.friendlyOdds(s,k))));break;
      case 'policy':G.choose(s,1);break;
      case 'build':G.lockDeck(s);break;
      case 'match':if(s.match.finished)G.exitMatch(s);else G.play(s,best([0,1,2].map(k=>G.odds(s,k))));break;
      case 'graduate':G.graduate(s,s.graduates[0]);break;
      case 'intake':
        while(G.flip(s)){}G.enroll(s,s.pack[0].id);
        G.setFocus(s,s.roster.find(p=>founders.has(p.id)&&!learned.has(p.id))?.id||s.focus);break;
      default:throw Error(s.phase);
    }
  }
  return [s.titles,camps,batteryReady,learned.size];
}
for(const [width,hand] of [[12,4],[16,4],[16,5]]){
  const totals=[0,0,0,0];
  for(let i=1;i<=count;i++)school(i*7919,width,hand).forEach((x,j)=>totals[j]+=x);
  console.log(JSON.stringify({schools:count,width,hand,summerTitlePct:100*totals[0]/(3*count),
    savedBatteryAtCampPct:100*totals[2]/totals[1],meanFoundersLearning:totals[3]/count}));
}
