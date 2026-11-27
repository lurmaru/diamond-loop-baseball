/* Diamond Loop — deterministic simulation shared by the browser and tests. */
(function () {
  'use strict';
  const D=typeof module!=='undefined'&&module.exports?require('./cards.js'):globalThis.ClubCards;
  const labels = ['打撃', '投球', '守備'];
  const policies = ['強打主義', '投手王国', '堅守野球'];
  const traits = ['勝負強さ', '奪三振', '好守'];
  const schools = ['港南工業', '稜北学院', '明星大附属', '白嶺学園', '東雲実業', '神楽坂高校'];
  const rounds = ['地区予選', '県大会決勝', '全国準決勝', '全国決勝'];
  const dates = ['4月 第1週','4月 第3週','5月 第1週','5月 第3週','6月 第1週','6月 第3週','9月 第1週','10月 第2週','12月 第1週','2月 第2週'];
  const families = '青山 北川 瀬戸 日高 藤野 立花 真壁 秋元 白石 平井 大森 桐谷 高梨 宮原 星野 天野 片桐 夏目 三原 神崎'.split(' ');
  const names = '湊 蓮 晴翔 陸 大地 颯太 悠真 拓海 海斗 悠生 翔 蒼 直樹 隼人 春樹 碧 航 亮太 千晴 伊織'.split(' ');
  const pos = ['投手','捕手','一塁手','二塁手','三塁手','遊撃手','左翼手','中堅手','右翼手'];
  const training = [
    ['打撃練習','特打ち','フルスイング特訓'],
    ['投球練習','ブルペン特訓','エースの投球術'],
    ['守備練習','連係ノック','鉄壁の守備陣']
  ];
  const situations = [
    ['満塁の好機','外角の直球が甘い。長打で走者を還そう。',0],
    ['中軸との勝負','相手の主砲は変化球に苦しんでいる。',1],
    ['一死一・二塁','相手はバントの構え。内野の連係が光る場面だ。',2]
  ];
  function random(s) {
    s.rng = (Math.imul(s.rng,1664525) + 1013904223) >>> 0;
    return s.rng / 4294967296;
  }
  const int = (s,n) => Math.floor(random(s)*n);
  const pick = (s,a) => a[int(s,a.length)];
  const potential={C:58,B:86,A:122,S:174,SS:250,Z:Infinity};
  const limitBonus=s=>4*s.facility[2]+(s.manuals||0);
  const cap=(s,p)=>Math.max(potential[p.rank],p.legacyBase||0)+limitBonus(s);
  function scoutProfile(s){
    const experience=(s.year-1)/18+s.wins/110+s.facility[1]/10;
    return {
      secondLook:0.88*(1-Math.exp(-experience)),
      startingBonus:Math.floor(4*Math.log2(1+experience))+2*s.facility[1]
    };
  }
  const styles=['基礎の徹底','個別指導','実戦主義'];
  const combos=['投打の柱','黄金バッテリー','攻守一体'];
  const comboPairs=[[0,1],[1,2],[2,0]];
  function addLog(s, title, detail, type='note') {
    s.logs.unshift({year:s.year,title,detail,type});
    s.logs.length = Math.min(36,s.logs.length);
  }
  function player(s, slot, grade, fresh=false) {
    const scout=scoutProfile(s);
    let roll=random(s);
    if(scout.secondLook>0 && random(s)<scout.secondLook)roll=Math.min(roll,random(s));
    if(s.rumor===slot)roll=Math.min(roll,random(s));
    const rank=roll<0.005?'Z':roll<0.025?'SS':roll<0.09?'S':roll<0.25?'A':roll<0.57?'B':'C';
    const genius=['S','SS','Z'].includes(rank);
    const bonus={C:0,B:2,A:5,S:8,SS:12,Z:16}[rank];
    const p={id:s.nextId++,name:pick(s,families)+' '+pick(s,names),slot,grade,genius,rank,face:int(s,10),
      stats:[],traits:[0,0,0]};
    for(let k=0;k<3;k++){
      const aptitude = k===(slot===0?1:slot%3)?6:0;
      p.stats.push(Math.min(cap(s,p),22+int(s,12)+aptitude+grade*2+bonus+scout.startingBonus));
    }
    if (genius || (fresh && random(s)<0.2)) p.traits[int(s,3)]=1;
    return p;
  }
  const tileNames={plain:'練習',good:'好調',bad:'逆風',event:'イベント',shop:'購買部',friendly:'練習試合',policy:'方針会議',skill:'特能指導',camp:'合宿',autumn:'秋予選',spring:'春本戦',rumor:'地元だより',alumni:'OB来訪',summer:'夏の大会',end:'年度末'};
  const gates=[3,7,11,18,22,24,27,35];
  const date=day=>((3+Math.floor(day/3))%12+1)+'月'+[1,11,21][day%3]+'日';
  function calendar(s){
    s.day=0;
    s.tiles=Array.from({length:36},()=>pick(s,['plain','good','bad','event','shop','friendly','good','plain']));
    for(const [day,type] of [[0,'plain'],[1,'good'],[2,'shop'],[3,'policy'],[4,'event'],[5,'friendly'],[6,'bad'],[7,'camp'],[9,'shop'],[11,'summer'],[13,'friendly'],[17,'shop'],[18,'autumn'],[22,'alumni'],[24,'camp'],[27,'rumor'],[33,'plain'],[26,'friendly'],[30,'shop'],[35,'end']])s.tiles[day]=type;
    s.drills=[0,0,0];s.visit=null;s.qualified=false;
  }
  function landing(s,c){
    const limit=(s.qualified?[...gates.slice(0,-1),33,35]:gates).find(d=>d>s.day)??35;
    return Math.min(s.day+c.steps,limit);
  }
  const deal=s=>D.refill(s,()=>random(s));
  const lockDeck=s=>D.lock(s,()=>random(s));
  function updateCard(s,c){
    const held=s.cards.find(h=>h.id===c.id);
    if(held)Object.assign(held,c);
  }
  function trainingTarget(s,c){
    if(c.effect==='pair'){
      const teammates=s.roster.filter(p=>p.slot===[2,1,5][c.k]);
      if(teammates.length)return teammates.find(p=>p.id===s.focus)||teammates[0];
    }
    return s.roster.find(p=>p.id===s.focus)||s.roster[0];
  }
  function skillOdds(s,c,camp){
    return (camp?(c.mentor?0.65:0.4):(c.mentor?0.2:0.1))+(s.policy===c.k&&s.style===0?0.05:0);
  }
  const skillName=c=>c.k===1&&c.effect==='pair'?'好リード':traits[c.k];
  function skillRoll(s,c,camp){
    const p=trainingTarget(s,c),success=random(s)<skillOdds(s,c,camp);
    const battery=skillName(c)==='好リード';
    if(success){if(battery)p.lead=(p.lead||0)+1;else p.traits[c.k]++;}
    const title=success?p.name+'が「'+skillName(c)+'」を習得！':'習得まであと一歩';
    const detail=success?skillName(c)+' Lv.'+(battery?p.lead:p.traits[c.k])+'。'+c.name+'での指導が実った。':p.name+'は'+c.name+'で経験を積んだ。';
    s.report={type:success?'talent':'training',title,detail,k:c.k,tier:c.tier};
    addLog(s,title,detail,success?'rare':'train');
  }
  function campTrain(s,index){
    if(s.phase!=='camp'||s.report||!s.cards[index])return false;
    const c=s.cards[index],p=trainingTarget(s,c);
    p.stats[c.k]=Math.min(cap(s,p),p.stats[c.k]+2);
    skillRoll(s,c,true);D.spend(s,index,()=>random(s));
    if(s.evolutionYear!==s.year&&random(s)<0.25&&s.library.some(v=>!v.evolved&&v.effect!=='chain')){
      s.phase='evolve';s.evolutionYear=s.year;
    }else s.phase='practice';
    return true;
  }
  function teach(s,id){
    if(s.report||!['evolve','mentor'].includes(s.phase))return false;
    const c=D.card(s,id);
    if(s.phase==='mentor'){
      const ob=s.visitor;
      if(!ob||!c||c.k!==ob.k||c.mentor)return false;
      c.mentor=ob.name;addLog(s,ob.name+'の直伝',c.name+'に現役時代の技を伝えた。','rare');s.visitor=null;
    }else{
      if(!c||c.evolved||c.effect==='chain')return false;
      c.evolved=true;addLog(s,c.name+'が進化',D.detail(c),'rare');
    }
    updateCard(s,c);s.phase='practice';return true;
  }
  function initial(seed=Date.now()){
    const s={version:4,rng:seed>>>0,year:1,week:0,phase:'intake',nextId:1,
      roster:[],cards:[],points:0,facility:[0,0,0],mastery:[0,0,0],policy:-1,
      focus:null,logs:[],titles:0,wins:0,games:0,best:0,challenge:0,record:0,
      match:null,options:[],report:null,graduates:[],heir:null,yearWins:0,skillPool:[],style:-1,manuals:0,cash:12};
    D.init(s);s.alumni=[];s.rumor=null;
    calendar(s);
    beginIntake(s,pos.map((_,i)=>i));
    return s;
  }
  function beginIntake(s,slots){
    s.phase='intake';s.drawn=0;
    const faces=Array.from({length:10},(_,i)=>i);
    s.pack=slots.map(slot=>{
      const p=player(s,slot,1,true);
      p.face=faces.splice(int(s,faces.length),1)[0];
      return p;
    });
  }
  function flip(s){
    if(s.phase!=='intake'||s.drawn>=s.pack.length)return false;
    s.drawn++;
    return true;
  }
  function enroll(s,id){
    if(s.phase!=='intake'||s.drawn!==s.pack.length)return false;
    const lead=s.pack.find(p=>p.id===id);
    if(!lead)return false;
    if(s.heir)lead.traits[s.heir.k]+=s.heir.level;
    s.focus=id;s.roster.push(...s.pack);s.roster.sort((a,b)=>a.slot-b.slot);
    addLog(s,s.pack.length+'人が入部',lead.name+'を重点育成。'+(s.heir?s.heir.name+'の「'+traits[s.heir.k]+'」を継承。':''),'spring');
    s.pack=[];s.heir=null;s.rumor=null;
    if(s.year===1){
      D.reset(s,()=>random(s));s.phase='practice';
    }else D.begin(s,'spring');
    return true;
  }
  function migrateDeck(s){
    if(s.version===3)return s;
    if(s.version===1){
      for(const p of [...s.roster,...(s.phase==='recruit'?s.options:[])]){
        p.face=p.id%10;p.rank=p.genius?'S':p.stats.some(v=>v>=42)?'A':'B';
      }
      calendar(s);s.cash=12;
      s.day=[0,3,4,6,7,9,11,17,22,28,35][s.week]??0;
      if(s.phase==='practice')s.cards.forEach((c,i)=>c.steps=i+1);
    }
    const oldHand=s.phase==='practice'?s.cards:[];
    D.init(s,oldHand);s.alumni=[];s.rumor=null;s.qualified=false;
    s.pile=D.shuffle(s.deck.filter(id=>!s.cards.some(c=>c.id===id)),()=>random(s));deal(s);
    for(const [d,t] of [[7,'camp'],[18,'autumn'],[22,'alumni'],[24,'camp'],[27,'rumor']]){
      if(d>s.day)s.tiles[d]=t;
    }
    if(s.phase==='shop'||s.phase==='prize')s.offers=D.offers(s,()=>random(s));
    if(s.phase==='event')s.eventCard=s.cards[0].id;
    if(s.phase==='match')s.match.competition='summer';
    s.version=3;return s;
  }
  function migrate(s){
    if(s.version===4)return s;
    migrateDeck(s);
    const players=[...s.roster,...(s.pack||[]),...(s.phase==='recruit'?s.options:[])];
    for(const p of players){
      const previous=Math.max(...p.stats);
      if(previous>cap(s,p))p.legacyBase=previous-limitBonus(s);
    }
    // Keep an existing, unfinished build exactly as the returning coach left it.
    s.version=4;return s;
  }
  function strength(s,k){
    if(!s.roster.length)return 0;
    const vals=s.roster.map(p=>p.stats[k]+3*p.traits[k]).sort((a,b)=>b-a);
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    const ace=s.roster.filter(p=>p.slot===0).sort((a,b)=>(b.stats[1]+3*b.traits[1])-(a.stats[1]+3*a.traits[1]))[0];
    const calling=k===1?Math.max(0,...s.roster.filter(p=>p.slot===1).map(p=>p.lead||0))*2:0;
    return calling+Math.round(k===1 && ace?avg*0.45+(ace.stats[1]+3*ace.traits[1])*0.55:avg*0.65+vals[0]*0.35);
  }
  const power=s=>Math.round(labels.reduce((a,_,k)=>a+strength(s,k),0)/3);
  function synergy(s,k){
    const ranks=comboPairs[k].map(a=>s.roster.reduce((sum,p)=>sum+p.traits[a],0));
    return {ranks,active:ranks.every(v=>v>=2)};
  }
  const distance=(s,c)=>landing(s,c)-s.day;
  function gain(s,c){
    const coaching=s.policy===c.k?1+Math.floor(Math.sqrt(s.mastery[c.k])/2):0;
    const daily=2+c.tier+s.drills[c.k]+Math.floor(s.facility[0]/2)+coaching;
    const chain=(c.evolved||c.effect==='chain')&&s.lastKind===(c.k+2)%3?2:0;
    return distance(s,c)*daily+(c.mentor?1:0)+chain;
  }
  function outlook(chance){
    if(chance>=0.69)return '有利';
    if(chance>=0.44)return 'いけそう';
    if(chance>=0.30)return '慎重に';
    return '厳しい';
  }
  function setFocus(s,id){
    if(!s.roster.some(p=>p.id===id))return false;
    s.focus=id;return true;
  }
  function practice(s,index){
    if(s.phase!=='practice'||s.report||!s.cards[index])return false;
    const c=s.cards[index],k=c.k,g=gain(s,c),steps=distance(s,c),lead=s.roster.find(p=>p.id===s.focus)||s.roster[0];
    let total=0;
    for(const p of s.roster){
      const old=p.stats[k];
      const extra=steps*(1+s.facility[0]%2)+(c.effect==='focus'?2:0)+(s.policy===k&&s.style===1?3:0);
      p.stats[k]=Math.min(cap(s,p),old+g+(p.id===lead.id?extra:0)+(p.genius?steps:0));
      total+=p.stats[k]-old;
    }
    if(c.effect==='pair'){
      const partner=trainingTarget(s,c),other=k===1?2:k;
      partner.stats[other]=Math.min(cap(s,partner),partner.stats[other]+2);
    }
    const dailyAwake=0.032+0.022*c.tier+(lead.genius?0.017:0)+(s.policy===k&&s.style===0?0.06:0);
    const awake=random(s)<1-(1-dailyAwake)**steps;
    const awakeningGain=awake?Math.min(4,cap(s,lead)-lead.stats[k]):0;
    lead.stats[k]+=awakeningGain;
    const target=landing(s,c),income=target-s.day;
    s.cash+=income;s.day=target;s.week++;
    s.report={type:awakeningGain?'awake':'practice',title:awakeningGain?lead.name+' が覚醒！':c.name+' 完了',
      detail:awakeningGain?labels[k]+'能力がさらに +'+awakeningGain+'。':labels[k]+'の合計成長 +'+total+'。重点選手は '+lead.name+'。',
      k,tier:c.tier};
    if(!awake && random(s)<0.017){
      s.manuals=(s.manuals||0)+1;s.points+=2;
      s.report={type:'manual',title:'黄金の指導書を発見！',detail:'学校の能力上限が永久に +1。さらに伝統Pt +2。',k,tier:2};
    }
    addLog(s,s.report.title,s.report.detail,s.report.type==='practice'?'train':'rare');
    const tile=s.tiles[s.day];
    let outcome='部費 +'+income+'G';
    if(tile==='good'){
      const bonus=Math.min(2,cap(s,lead)-lead.stats[k]);
      s.cash+=4;lead.stats[k]+=bonus;
      outcome+=' ／ 好調！'+(bonus?'重点選手 +'+bonus+'、':'')+'部費 +4G';
    }else if(tile==='bad'){
      const repair=Math.min(4,s.cash);s.cash-=repair;outcome+=' ／ 用具修理 −'+repair+'G';
    }
    s.lastStop=date(s.day)+'・'+tileNames[tile]+' ｜ '+outcome;
    addLog(s,date(s.day)+'・'+tileNames[tile],outcome);
    D.spend(s,index,()=>random(s));
    if(tile==='camp'){s.phase='camp';}
    else if(tile==='autumn'||tile==='spring')startMatch(s,0,tile);
    else if(tile==='rumor'){
      s.rumor=pick(s,[0,1,1,5]);s.lastStop='地元だより・有望な'+pos[s.rumor]+'が近隣に。次の入学式で期待上昇。';
      addLog(s,'地元だより',s.lastStop);s.phase='practice';
    }else if(tile==='alumni'){
      const eligible=s.alumni.filter(ob=>s.library.some(v=>v.k===ob.k&&!v.mentor));
      if(eligible.length){s.visitor=pick(s,eligible);s.phase='mentor';}
      else {s.phase='event';s.visit={k};s.eventCard=c.id;}
    }else if(tile==='policy'){s.phase='policy';s.options=[0,1,2].map(k=>({k,bonus:1+int(s,3),style:int(s,3)}));}
    else if(tile==='skill'){s.phase='skill';s.skillPool=[0,1,2].map(k=>({k,id:pick(s,s.roster).id,amount:random(s)<0.13?2:1}));}
    else if(tile==='summer')startMatch(s,0);
    else if(tile==='end'){s.phase='graduate';s.graduates=s.roster.filter(p=>p.grade===3).map(p=>p.id);}
    else if(['event','shop','friendly'].includes(tile)){
      s.phase=tile;s.eventCard=c.id;
      if(tile==='shop')s.offers=D.offers(s,()=>random(s));
      s.visit={sold:[false,false,false],k:int(s,3),opp:pick(s,schools),level:35+int(s,15)+s.challenge*4};
    }else deal(s);
    return true;
  }
  const price=(s,i)=>s.offers?.[i]!=null?10+4*D.make(s.offers[i]).tier:Infinity;
  function expandHand(s){
    if(s.phase!=='shop'||s.report||s.cash<D.slotPrice(s)||s.handSize>=s.deck.length-1)return false;
    s.cash-=D.slotPrice(s);s.handSize++;deal(s);
    addLog(s,'手札枠を拡張','これからは '+s.handSize+' 枚まで持てる。');return true;
  }
  const friendlyOdds=(s,k)=>Math.max(.20,Math.min(.9,.55+(strength(s,k)-s.visit.level)/80+(s.visit.k===k?.14:0)));
  function visitAction(s,n){
    if(s.report||!Number.isInteger(n)||n<0||n>3)return false;
    let message;
    if(s.phase==='shop'){
      if(n===3)message='買い物を終えた';
      else {
        const id=s.offers[n],amount=price(s,n);
        if(s.cash<amount||!D.acquire(s,id))return false;
        s.cash-=amount;addLog(s,D.card(s,id).name+'を購入','次の編成から採用可能。');return true;
      }
    }else if(s.phase==='event'){
      if(n>1)return false;
      if(n===0){s.cash+=10;message='後援会の手伝いで部費 +10G';}
      else {skillRoll(s,D.card(s,s.eventCard)||s.cards[0],false);message=s.report.title;}
    }else if(s.phase==='friendly'&&n<3){
      if(random(s)<friendlyOdds(s,n)){
        s.phase='prize';s.offers=D.offers(s,()=>random(s));s.cash+=8;addLog(s,'練習試合に勝利','部費 +8G。練習帳に加える札を選べる。','win');return true;
      }
      s.cash+=2;message='練習試合に敗戦。参加助成 +2G';
    }else if(s.phase==='prize'&&n<3){
      if(!D.acquire(s,s.offers[n]))return false;
      message=D.card(s,s.offers[n]).name+'を練習帳に登録';
    }else if(s.phase==='prize'&&n===3){message='勝利報酬の部費を受け取った';}
    else return false;
    addLog(s,message,date(s.day));s.phase='practice';s.visit=null;deal(s);return true;
  }
  function acknowledge(s){if(!s.report)return false;s.report=null;return true;}
  function choose(s,k){
    if(s.report||![0,1,2].includes(k))return false;
    if(s.phase==='policy'){
      s.policy=k;s.style=s.options[k].style;s.mastery[k]++;
      for(const p of s.roster)p.stats[k]=Math.min(cap(s,p),p.stats[k]+s.options[k].bonus);
      addLog(s,policies[k]+'を採用',labels[k]+'の練習に相乗効果。指導経験が残る。');
    }else if(s.phase==='skill'){
      const o=s.skillPool[k],p=s.roster.find(p=>p.id===o.id);
      p.traits[k]+=o.amount;
      addLog(s,p.name+' が'+traits[k]+'を習得','試合時の'+labels[k]+'評価が上昇。','rare');
    }else return false;
    s.phase='practice';deal(s);return true;
  }
  function startMatch(s,round,competition='summer'){
    s.phase='match';
    const rivals=schools.filter(n=>!s.rivals?.includes(n));
    const opp=pick(s,rivals.length?rivals:schools);
    s.rivals=round===0?[opp]:[...(s.rivals||[]),opp];
    s.match={round,opp,competition,level:(competition==='summer'?44+round*11:competition==='autumn'?57:68+round*10)+8*s.challenge,
      us:0,them:0,step:0,scene:int(s,3),plays:[],finished:false};
  }
  const matchName=m=>m.competition==='autumn'?'秋季予選 決勝':m.competition==='spring'?['春の本戦 準決勝','春の本戦 決勝'][m.round]:rounds[m.round];
  const lastRound=m=>m.competition==='spring'?1:m.competition==='autumn'?0:3;
  const odds=(s,k)=>{
    const m=s.match;
    const d=strength(s,k)*0.60+power(s)*0.40+(k===s.policy?(s.style===2?6:3):0)+(k===situations[m.scene][2]?10:0)+(synergy(s,k).active?5:0)-m.level;
    return 0.08+0.84/(1+Math.exp(-d/12));
  };
  function play(s,k){
    const m=s.match;
    if(s.report||s.phase!=='match'||!m||m.finished||![0,1,2].includes(k))return false;
    const success=random(s)<odds(s,k);
    // Three highlights summarize innings 1–3, 4–6 and 7–9.
    let runs,against;
    if(k===0){runs=success?2+int(s,3):int(s,2);against=success?int(s,2):2+int(s,3);}
    else if(k===1){runs=success?1+int(s,3):int(s,2);against=success?int(s,2):1+int(s,3);}
    else {runs=success?1+int(s,2):int(s,2);against=success?0:1+int(s,2);}
    m.us+=runs;m.them+=against;m.step++;
    m.plays.push({k,success,runs,against});
    if(m.step===3 && m.us===m.them){m.extra=true;}
    if(m.step>=3 && m.us!==m.them){
      m.finished=true;s.games++;
      const won=m.us>m.them;
      const reward=won?2+m.round+s.challenge:1;
      s.points+=reward;s.cash+=won?8:3;
      if(won){s.wins++;s.yearWins++;if(!m.competition||m.competition==='summer')s.best=Math.max(s.best,m.round+1);}
      if(won&&m.competition==='spring'&&m.round===1){
        s.springTitles=(s.springTitles||0)+1;s.record=Math.max(s.record,s.challenge+1);
      }
      if(won&&m.round===3){s.titles++;s.record=Math.max(s.record,s.challenge+1);}
      addLog(s,(won?'勝利':'敗戦')+'・'+matchName(m),m.us+' 対 '+m.them+'　'+m.opp+'｜伝統Pt +'+reward+' ／ 部費 +'+(won?8:3)+'G',won?'win':'game');
    }else m.scene=(m.scene+1+int(s,2))%3;
    return true;
  }
  function exitMatch(s){
    if(s.report||s.phase!=='match'||!s.match.finished)return false;
    const m=s.match;
    if(m.us>m.them && m.round<lastRound(m))startMatch(s,m.round+1,m.competition);
    else {
      s.match=null;
      if(!m.competition||m.competition==='summer')D.begin(s,'summer');
      else {
        if(m.competition==='autumn'){
          s.qualified=m.us>m.them;s.tiles[33]=s.qualified?'spring':'plain';
          addLog(s,s.qualified?'春本戦 出場決定':'秋予選 敗退',s.qualified?'3月1日に準決勝。':'次の夏に向けて練習を続けよう。');
        }
        s.phase='practice';
      }
    }
    return true;
  }
  function graduate(s,id){
    if(s.report||s.phase!=='graduate')return false;
    if(s.graduates.length){
      if(!s.graduates.includes(id))return false;
      const p=s.roster.find(v=>v.id===id);
      const keys=[0,1,2].sort((a,b)=>(p.traits[b]-p.traits[a])||(p.stats[b]-p.stats[a]));
      for(const senior of s.roster.filter(v=>v.grade===3)){
        const best=[0,1,2].sort((a,b)=>senior.traits[b]-senior.traits[a]||senior.stats[b]-senior.stats[a])[0];
        s.alumni.push({id:senior.id,name:senior.name,k:(senior.lead||0)>senior.traits[best]?1:best,face:senior.face,year:s.year});
      }
      s.heir={name:p.name,k:keys[0],level:Math.max(1,Math.ceil(p.traits[keys[0]]/2))};
    }
    s.roster=s.roster.filter(v=>v.grade<3);
    s.roster.forEach(v=>v.grade++);
    s.points+=3;addLog(s,s.graduates.length?s.graduates.length+'人が卒業':'進級式','年度報酬 伝統Pt +3。','spring');
    const slots=pos.map((_,i)=>i).filter(i=>!s.roster.some(p=>p.slot===i));
    for(let i=0;slots.length<3;i++){
      const slot=(s.year*3+i)%9;
      if(!slots.includes(slot))slots.push(slot);
    }
    if(s.rumor!=null&&!slots.includes(s.rumor)&&random(s)<0.65)slots.push(s.rumor);
    s.year++;s.week=0;s.yearWins=0;s.policy=-1;s.style=-1;s.lastStop='';
    calendar(s);beginIntake(s,slots);return true;
  }
  function recruit(s,i){
    if(s.phase!=='recruit'||!s.options[i])return false;
    const p=s.options[i],h=s.heir;
    p.traits[h.k]+=h.level;
    const incoming=[p,...s.openSlots.slice(1).map(slot=>player(s,slot,1,true))];
    s.roster.push(...incoming);s.roster.sort((a,b)=>a.slot-b.slot);s.focus=p.id;
    s.report={type:incoming.some(v=>v.genius)?'genius':'scout',title:incoming.some(v=>v.genius)?'天才球児、入部！':'新世代、始動！',
      detail:incoming.map(v=>v.name+(v.genius?' ★天才':'')).join('・')+' が入部。'+p.name+'は「'+traits[h.k]+'」を継承。',k:h.k,tier:2};
    addLog(s,s.report.title,s.report.detail,'spring');
    s.options=[];s.heir=null;D.begin(s,'spring');return true;
  }
  const cost=(s,k)=>4+s.facility[k]*3;
  function upgrade(s,k){
    if(![0,1,2].includes(k)||s.points<cost(s,k))return false;
    s.points-=cost(s,k);s.facility[k]++;
    addLog(s,['練習設備','スカウト網','育成研究室'][k]+'を強化','施設 Lv.'+s.facility[k]);return true;
  }
  function setChallenge(s,n){
    if(s.day>=11||s.phase!=='practice'||!Number.isInteger(n)||n<0||n>Math.max(s.record,s.year>=3?1:0))return false;
    s.challenge=n;return true;
  }
  const api={D,potential,limitBonus,scoutProfile,distance,outlook,skillName,lockDeck,expandHand,campTrain,teach,skillOdds,trainingTarget,matchName,lastRound,calendar,date,tileNames,landing,flip,enroll,migrate,visitAction,price,friendlyOdds,labels,policies,styles,traits,combos,comboPairs,synergy,pos,rounds,dates,situations,training,initial,cap,gain,strength,power,setFocus,practice,choose,acknowledge,odds,play,exitMatch,graduate,recruit,cost,upgrade,setChallenge};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else globalThis.DiamondGame=api;
})();
