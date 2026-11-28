/* Starfall Guild. All game decisions use the saved random stream. */
(function(){
  'use strict';
  const common=typeof module==='object'?require('./cards.js'):globalThis.ClubCards;
  const Y=typeof module==='object'?require('./calendar.js'):globalThis.ClubCalendar;
  const fields=['剣技','秘術','探索'];
  const arts=['連撃','星詠術','罠師'];
  const artNotes=['敵の隙を突く剣撃に追撃','星術の回復量と結界への威力が上昇','猛攻を迎撃すると反撃の威力が上昇'];
  const roles=[
    ['剣士','剣撃の威力 +2'],['魔道士','星術の威力 +3'],['斥候','迎撃で次の攻撃に隙を作る'],
    ['守護騎士','受けるダメージ −1'],['錬金術師','星術の回復量 +3'],['狩人','迎撃の威力 +3'],
    ['傭兵','体力が半分以下なら剣撃の威力 +4'],['星詠み','遠征開始時の星力 +2'],['吟遊詩人','戦闘に勝つたびに体力 +4']
  ];
  const names=['ユナ','エルン','ミラ','シオン','フェイ','トルカ','ニル','オルガ','リュカ','テオ','イリス','カイル','ナギ','ベル','ルカ','セラ','エダ','オズ','メル','アトリ','ルネ','ロイ','ラズ','シス'];
  const ranks=['C','B','A','S','SS','Z'],limits=[50,68,92,128,180,Infinity];
  const cardNames=[
    ['木剣の稽古','剣舞','崖道の踏破','鎧割り','護衛の隊列','一閃の型','火花の剣舞','緋竜の構え','黎明の剣'],
    ['水晶の研磨','星図の読解','魔力循環','火紋の研究','結界の縫合','月鏡の瞑想','灯火の連鎖','銀河の写本','流星の詠唱'],
    ['足跡探し','野営術','尾根歩き','薬草採集','影渡り','風読み','古道の測量','精霊の道標','夜空の航路']
  ];
  const D=common.createCatalog(id=>{
    const k=id%3,row=Math.floor(id/3);
    return {id,k,name:cardNames[k][row],steps:[3,5,8][(row+k)%3],tier:row<3?0:row<7?1:2,
      effect:['','','','','pair','focus','chain','focus','chain'][row],evolved:false,mentor:null};
  },c=>[c.effect==='pair'?'同系統の職業を追加育成':c.effect==='focus'?'師弟稽古の経験増':'',
    c.effect==='chain'||c.evolved?fields[(c.k+2)%3]+'の次に連携':'',c.mentor?c.mentor+'直伝':''].filter(Boolean).join(' ・ '));
  const tileNames={plain:'修練',good:'霊脈',bad:'荒天',shop:'市集',event:'祠',friendly:'小依頼',policy:'旅団の誓い',camp:'星見の野営',summer:'夏の大遠征',autumn:'星門の試練',spring:'星塔遠征',alumni:'先達の帰還',rumor:'旅人の噂',end:'契約満了'};
  const oaths=['朱刃の誓い','蒼星の誓い','翠風の誓い'];
  const workshops=[
    ['修練場','修練札で得る経験を増やす'],['案内所','高資質の冒険者が訪れやすくなる'],
    ['星の書庫','全員の能力上限を3ずつ広げる'],['天文台','野営での奥義習得率が上がる'],['交易所','毎月の金貨収入が増える']
  ];
  const enemies=[['苔むす石巨人','剣撃に弱い',[0,1,2]],['霧まといの精霊','星術に弱い',[1,2,0]],['星喰いの竜','迎撃に弱い',[2,0,1]]];
  const intents=['猛攻','結界','隙'];
  const expeditions={summer:'玻璃の谷',autumn:'星門の試練',spring:'夜明けの星塔'};
  const lengths={summer:3,autumn:1,spring:2};
  const rand=s=>((s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0)/4294967296);
  const roll=(s,n)=>Math.floor(rand(s)*n);
  const sample=(s,a)=>a[roll(s,a.length)];
  function log(s,title,detail=''){s.logs.unshift({year:s.year,day:s.day,title,detail});s.logs.length=Math.min(s.logs.length,45);}
  function notice(s,title,detail,rare=false){s.notice={title,detail,rare};log(s,title,detail);}
  function cap(s,p){return limits[p.rank]+3*s.facility[2];}
  function xp(s,p,k,points){
    if(p.stats[k]>=cap(s,p))return 0;
    const total=p.xp[k]+Math.round(points*10);
    const gain=Math.min(cap(s,p)-p.stats[k],Math.floor(total/100));
    p.stats[k]+=gain;p.xp[k]=p.stats[k]===cap(s,p)?0:total%100;return gain;
  }
  function recruit(s,k){
    const role=s.rumor!==null&&s.rumor%3===k&&rand(s)<.68?s.rumor:k+3*roll(s,3);
    const renown=1-Math.exp(-(s.year-1)/48-s.wins/95-s.facility[1]/11);
    const luck=rand(s),high=.14+.70*renown;
    const rank=luck<high*(.008+.01*renown)?5:luck<high*.065?4:luck<high*.28?3:luck<high?2:luck<.52+.28*renown?1:0;
    const used=new Set([...s.roster,...s.pack].map(p=>p.name));
    const name=sample(s,names.filter(n=>!used.has(n)));
    const stats=fields.map((_,i)=>Math.min(limits[rank],15+rank*2+roll(s,7)+(k===i?6:0)+Math.floor(8*renown)));
    return {id:s.next++,name,role,rank,year:s.year,stats,xp:[0,0,0],arts:[0,0,0]};
  }
  function season(s){
    s.day=0;s.qualified=false;s.tiles=Y.make(()=>rand(s));s.phase='intake';s.last='';s.oath=-1;
    s.pack=[];for(let k=0;k<3;k++)s.pack.push(recruit(s,k));
    s.pack=D.shuffle(s.pack,()=>rand(s));s.drawn=0;s.rumor=null;
    s.blessings=D.shuffle(['study','journey','wealth'],()=>rand(s));
  }
  function initial(seed){
    const s={version:1,rng:seed>>>0,year:1,day:0,next:1,roster:[],party:[],focus:0,pack:[],veterans:[],heir:null,
      facility:[0,0,0,0,0],lantern:0,gold:22,stars:0,wins:0,crowns:0,cleared:-1,depth:0,mastery:[0,0,0],rumor:null,
      logs:[],last:'',notice:null,expedition:null,offers:[],eventCard:null,evolvedYear:0};
    D.init(s);season(s);return s;
  }
  function reveal(s,all=false){
    if(s.phase!=='intake'||s.drawn>=s.pack.length)return false;
    s.drawn=all?s.pack.length:s.drawn+1;return true;
  }
  function fillParty(s){
    const ids=s.roster.map(p=>p.id);
    s.party=[...new Set([...s.party.filter(id=>ids.includes(id)),...ids])].slice(0,3);
  }
  function accept(s,id){
    const p=s.pack.find(v=>v.id===id);
    if(s.phase!=='intake'||s.drawn!==s.pack.length||!p)return false;
    if(s.heir){p.arts[s.heir.k]+=s.heir.level;log(s,p.name+'が技を継承',s.heir.name+'の'+arts[s.heir.k]+' Lv.'+s.heir.level);}
    s.roster.push(...s.pack);s.focus=p.id;
    fillParty(s);
    s.pack=[];s.heir=null;
    if(s.year===1){D.reset(s,()=>rand(s));s.phase='practice';}else D.begin(s,'spring');
    log(s,'新たな冒険者が加入',p.name+'を重点育成する。');return true;
  }
  const party=s=>s.party.map(id=>s.roster.find(p=>p.id===id)).filter(Boolean);
  function setParty(s,id,slot){
    if((s.expedition&&s.phase!=='prepare')||!s.roster.some(p=>p.id===id)||!Number.isInteger(slot)||slot<0||slot>=s.party.length||s.party[slot]===id)return false;
    const old=s.party.indexOf(id);
    if(old!==-1)s.party[old]=s.party[slot];
    s.party[slot]=id;return true;
  }
  function focus(s,id){if(!s.roster.some(p=>p.id===id))return false;s.focus=id;return true;}
  const distance=(s,c)=>Y.landing(s,c)-s.day;
  function credit(s,c){
    const days=distance(s,c),chain=(c.effect==='chain'||c.evolved)&&s.lastKind===(c.k+2)%3;
    return days*(1+.07*(days-1))*(.85+c.tier*.35+Math.sqrt(s.facility[0])*.13+(s.oath===c.k?(s.blessings[c.k]==='study'?.40:.16):0))+(chain?3:0)+(c.mentor?1:0);
  }
  function train(s,index){
    const c=s.cards[index];
    if(s.phase!=='practice'||s.notice||!c)return false;
    const days=distance(s,c),points=credit(s,c),before=s.day;
    for(const p of s.roster){
      const affinity=p.role%3;
      xp(s,p,c.k,points+(p.id===s.focus?days*.28+(c.effect==='focus'?2:0):0)+(c.effect==='pair'&&affinity===c.k?2:0));
      xp(s,p,affinity,days*.33);
    }
    D.spend(s,index,()=>rand(s));s.day+=days;s.eventCard=c.id;
    const tile=s.tiles[s.day];
    if(Y.starts.some(d=>d>before&&d<=s.day))s.gold+=2+s.facility[4];
    s.last=c.name+' ・ '+days+'日間、'+fields[c.k]+'を修練。';
    if(tile==='good'){s.gold+=4;s.last+=' 霊脈で金貨 +4。';}
    if(tile==='bad'){s.gold=Math.max(0,s.gold-1);s.last+=' 荒天で金貨 −1。';}
    if(['summer','autumn','spring'].includes(tile))beginExpedition(s,tile);
    else if(tile==='end'){s.phase='succession';}
    else if(tile==='policy'){s.phase='oath';}
    else if(tile==='alumni'){
      if(s.veterans.length){s.teacher=sample(s,s.veterans);s.phase='mentor';}
      else{s.gold+=4;s.last='巡礼商人が金貨4枚を寄進した。';}
    }else if(tile==='rumor'){
      s.rumor=roll(s,9);s.last='旅人の噂。次の春には'+roles[s.rumor][0]+'が訪れやすい。';log(s,'旅人の噂',s.last);
    }else if(['camp','shop','event','friendly'].includes(tile)){
      s.phase=tile;if(tile==='shop')s.offers=D.offers(s,()=>rand(s));
      if(tile==='friendly')s.weak=roll(s,3);
    }
    if(rand(s)<1-(1-.0025)**days){
      const p=s.roster.find(v=>v.id===s.focus);
      if(p&&p.stats[c.k]<cap(s,p)){xp(s,p,c.k,30);notice(s,p.name+'が覚醒！',fields[c.k]+'が磨かれた。現在 '+p.stats[c.k]+'。',true);}
    }
    return true;
  }
  function auto(s){
    if(s.notice||s.phase!=='practice')return false;
    const start=s.day;
    while(s.phase==='practice'&&!s.notice&&s.day-start<15){
      const picks=s.cards.map((c,i)=>({i,score:credit(s,c)+(s.oath===c.k?2:0),days:distance(s,c)})).filter(v=>v.days<=15-(s.day-start));
      if(!picks.length)break;
      train(s,picks.sort((a,b)=>b.score-a.score)[0].i);
    }
    return s.day>start;
  }
  function chooseOath(s,k){
    if(s.phase!=='oath'||s.notice||!fields[k])return false;
    s.oath=k;s.mastery[k]++;if(s.blessings[k]==='wealth')s.gold+=14;
    s.phase='practice';log(s,oaths[k],fields[k]+'系の修練と戦技を強化。');return true;
  }
  function lesson(s,c,camp){
    const p=s.roster.find(v=>v.id===s.focus);
    const chance=(camp?(c.mentor?.67:.43):(c.mentor?.21:.10))+(camp?.16*s.facility[3]/(3+s.facility[3]):0);
    if(camp)xp(s,p,c.k,8);
    if(rand(s)<chance){p.arts[c.k]++;notice(s,p.name+'が「'+arts[c.k]+'」を習得！','奥義 Lv.'+p.arts[c.k]+'。'+artNotes[c.k]+'。',true);}
    else notice(s,'修行を終えた',p.name+'は'+arts[c.k]+'の手がかりを得た。');
  }
  function camp(s,i){
    const c=s.cards[i];if(s.phase!=='camp'||s.notice||!c)return false;
    lesson(s,c,true);D.spend(s,i,()=>rand(s));s.phase='practice';
    if(s.evolvedYear!==s.year&&s.library.some(v=>!v.evolved&&v.effect!=='chain')&&rand(s)<.32){s.evolvedYear=s.year;s.phase='evolve';}
    return true;
  }
  function teach(s,id){
    if(s.notice||!['evolve','mentor'].includes(s.phase))return false;
    const c=D.card(s,id),mentor=s.phase==='mentor';
    if(!c||(mentor?c.k!==s.teacher.k||c.mentor:c.evolved||c.effect==='chain'))return false;
    if(mentor)c.mentor=s.teacher.name;else c.evolved=true;
    Object.assign(s.cards.find(v=>v.id===id)||{},c);
    s.phase='practice';notice(s,c.name+(mentor?'に直伝が宿った':'が進化！'),D.detail(c),true);return true;
  }
  const price=id=>12+D.make(id).tier*6;
  const lanternPrice=s=>100+40*(s.lantern||0);
  function visit(s,n){
    if(s.notice||!Number.isInteger(n)||n<0)return false;
    if(s.phase==='shop'||s.phase==='loot'){
      if(n===3){s.phase='practice';return true;}
      if(n===5&&s.phase==='shop'){
        if(s.gold<lanternPrice(s))return false;
        s.gold-=lanternPrice(s);s.lantern=(s.lantern||0)+1;
        s.last='星灯のランタンを補強。遠征の最大体力が永久に2増えた。';log(s,'星灯のランタンを補強',s.last);return true;
      }
      if(n===4&&s.phase==='shop'){
        if(s.handSize>=s.deck.length-1||s.gold<D.slotPrice(s))return false;
        s.gold-=D.slotPrice(s);s.handSize++;D.refill(s,()=>rand(s));s.last='手札が永久に'+s.handSize+'枠に増えた。';return true;
      }
      const id=s.offers[n];if(id===undefined)return false;
      const cost=s.phase==='shop'?price(id):0;
      if(s.gold<cost||!D.acquire(s,id))return false;
      s.gold-=cost;log(s,D.card(s,id).name+'の札を入手','次の組み替えから採用可能。');
      if(s.phase==='loot')s.phase='practice';s.last=D.card(s,id).name+'を修練帳に登録した。';return true;
    }
    if(s.phase==='event'&&n<2){
      if(n===0){s.gold+=8;s.last='祠の修繕を手伝い、金貨8枚を受け取った。';}
      else lesson(s,D.card(s,s.eventCard),false);
      s.phase='practice';return true;
    }
    if(s.phase==='friendly'&&n<3){
      const score=rating(s,n),ok=rand(s)<Math.min(.90,.44+score/220+(s.weak===n?.20:0));
      for(const p of party(s))xp(s,p,n,2);
      s.gold+=ok?7:2;s.last=(ok?'依頼達成！ 金貨 +7。':'依頼から帰還。金貨 +2。')+fields[n]+'の実戦経験を得た。';log(s,'街道の小依頼',s.last);
      s.phase=ok?'loot':'practice';if(ok)s.offers=D.offers(s,()=>rand(s),true);return true;
    }
    return false;
  }
  function succession(s,id){
    if(s.phase!=='succession'||s.notice)return false;
    const leaving=s.roster.filter(p=>s.year-p.year>=2),teacher=leaving.find(p=>p.id===id);
    if(leaving.length&&!teacher)return false;
    for(const p of leaving){
      const k=[0,1,2].sort((a,b)=>p.arts[b]-p.arts[a]||p.stats[b]-p.stats[a])[0];
      const legacy={name:p.name,k,level:Math.max(1,Math.ceil(p.arts[k]/2))};
      s.veterans.push(legacy);if(p===teacher)s.heir=legacy;
    }
    if(s.veterans.length>90)s.veterans.splice(0,s.veterans.length-90);
    s.roster=s.roster.filter(p=>s.year-p.year<2);fillParty(s);
    s.stars+=2+leaving.length;s.year++;season(s);return true;
  }
  const cost=(s,i)=>3+2*s.facility[i];
  function upgrade(s,i){if(!workshops[i]||s.notice||s.stars<cost(s,i))return false;s.stars-=cost(s,i);s.facility[i]++;log(s,workshops[i][0]+'を拡張','Lv.'+s.facility[i]);return true;}
  function depth(s,n){if(s.expedition||!Number.isInteger(n)||n<0||n>s.cleared+1)return false;s.depth=n;return true;}
  function rating(s,k){
    const team=party(s);
    if(!team.length)return 0;
    return Math.round(team.reduce((a,p)=>a+p.stats[k]+3*p.arts[k],0)/team.length)+(s.oath===k?2:0)+Math.floor(Math.sqrt(s.mastery[k]||0));
  }
  const relics=[
    ['燠火の護符','遠征中、剣撃の威力 +3'],['月泉の雫','体力を最大値の半分回復し、星力 +2'],
    ['星晶の欠片','遠征中、星術の威力 +3'],['風鈴の罠','遠征中、迎撃の威力 +3'],['星の古貨','功績 +2。拠点の施設に投資できる']
  ];
  function beginExpedition(s,kind){
    s.expedition={kind,depth:s.depth,floor:0};s.phase='prepare';
  }
  function launch(s){
    if(s.phase!=='prepare'||s.notice||party(s).length!==3||new Set(s.party).size!==3)return false;
    const e=s.expedition,team=party(s),average=fields.reduce((a,_,i)=>a+rating(s,i),0)/3;
    e.maxHP=26+Math.floor(average*.23)+(s.blessings[s.oath]==='journey'?5:0)+2*(s.lantern||0);e.hp=e.maxHP;e.boost=[0,0,0];
    e.mp=Math.min(6,2+2*team.filter(p=>p.role===7).length+(new Set(team.map(p=>p.role%3)).size===3?1:0));
    enterRoom(s);return true;
  }
  function enterRoom(s){
    const e=s.expedition;
    e.foe=e.kind==='summer'?e.floor:e.kind==='autumn'?1:(e.floor===1?2:roll(s,2));
    const level=(e.kind==='summer'?0:e.kind==='spring'?5:7)+e.depth*2+3*e.floor;
    e.level=level;e.enemyMax=31+4*level+(e.foe===2?4:0);e.enemyHP=e.enemyMax;
    e.turn=0;e.intent=enemies[e.foe][2][roll(s,3)];e.open=false;e.counts=[0,0,0];e.last='';s.phase='battle';
  }
  const has=(s,role)=>party(s).filter(p=>p.role===role).length;
  function strike(s,k){
    if(s.phase!=='battle'||s.notice||!Number.isInteger(k)||!fields[k])return false;
    const e=s.expedition;if(k===1&&e.mp<2)return false;
    const intent=e.intent,affinity=party(s).filter(p=>p.role%3===k).length;
    const technique=Math.ceil(Math.sqrt(party(s).reduce((sum,p)=>sum+p.arts[k],0)));
    let damage=[6,8,3][k]+Math.floor(rating(s,k)/12)+e.boost[k]+(affinity>=2?2:0)+roll(s,3);
    if(k===e.foe)damage+=2;
    if(e.open||intent===2)damage+=3;
    if(k===0){damage+=2*has(s,0)+(e.hp<=e.maxHP/2?4*has(s,6):0)+(e.open||intent===2?2*technique:0);e.mp=Math.min(6,e.mp+1);}
    if(k===1){e.mp-=2;damage+=3*has(s,1)+(intent===1?technique:0);e.hp=Math.min(e.maxHP,e.hp+2+3*has(s,4)+technique);}
    if(k===2){e.mp=Math.min(6,e.mp+2);damage+=3*has(s,5)+(intent===0?4+2*technique:0);}
    if(intent===1&&k!==1)damage=Math.max(1,Math.floor(damage*.52));
    e.open=k===2&&(intent===0||has(s,2)>0);
    e.enemyHP=Math.max(0,e.enemyHP-damage);e.counts[k]++;e.turn++;
    let incoming=0;
    if(e.enemyHP){
      incoming=Math.max(1,(intent===0?10:intent===1?5:6)+e.level+roll(s,3)-Math.floor(rating(s,2)/23)-has(s,3)-(k===2?(intent===0?8:4):0));
      e.hp=Math.max(0,e.hp-incoming);
    }
    e.last=['剣撃','星術','迎撃'][k]+'で '+damage+' ダメージ。'+(incoming?' 味方に '+incoming+' ダメージ。':'');
    if(e.enemyHP&&e.hp){const pattern=enemies[e.foe][2];e.intent=pattern[(pattern.indexOf(intent)+1)%3];return true;}
    e.won=e.enemyHP===0;
    for(const p of party(s))for(const [i,n] of e.counts.entries())if(n)xp(s,p,i,12*n/e.turn);
    s.gold+=e.won?6+e.floor:2;s.stars+=e.won?2:1;
    if(e.won){s.wins++;e.hp=Math.min(e.maxHP,e.hp+4*has(s,8));}
    const end=e.floor+1===lengths[e.kind];
    if(e.won&&end){
      if(e.kind==='autumn'){s.qualified=true;s.tiles[Y.events.spring]='spring';}
      else{s.crowns++;s.cleared=Math.max(s.cleared,e.depth);}
    }
    e.finished=!e.won||end;
    e.summary=(e.won?'勝利':'撤退')+'。出撃した3人が'+e.counts.map((v,i)=>v?fields[i]:'').filter(Boolean).join('・')+'の実戦経験を獲得。';
    log(s,enemies[e.foe][0]+'との戦い',e.summary);
    if(e.won&&!end){e.rewards=D.shuffle([0,1,2,3,4],()=>rand(s)).slice(0,3);if(!e.rewards.includes(1))e.rewards[2]=1;}
    s.phase='result';return true;
  }
  function advance(s,index){
    if(s.phase!=='result'||s.notice)return false;
    const e=s.expedition;
    if(!e.finished){
      const r=e.rewards[index];if(r===undefined)return false;
      if(r===1){e.hp=Math.min(e.maxHP,e.hp+Math.ceil(e.maxHP/2));e.mp=Math.min(6,e.mp+2);}
      else if(r===4)s.stars+=2;
      else e.boost[[0,0,1,2][r]]+=3;
      log(s,relics[r][0]+'を獲得',relics[r][1]);e.floor++;enterRoom(s);
    }else{
      s.last=expeditions[e.kind]+'から帰還。'+e.summary;
      s.expedition=null;if(e.kind==='summer')D.begin(s,'summer');else s.phase='practice';
    }
    return true;
  }
  const api={Y,D,fields,arts,artNotes,roles,ranks,limits,workshops,enemies,intents,oaths,tileNames,relics,expeditions,lengths,
    initial,reveal,accept,party,setParty,focus,cap,distance,credit,train,auto,chooseOath,camp,teach,visit,price,lanternPrice,succession,cost,upgrade,depth,rating,launch,strike,advance,
    acknowledge(s){if(!s.notice)return false;s.notice=null;return true;},
    lock(s){return D.lock(s,()=>rand(s));},toggle:D.toggle,
    skipMentor(s){if(s.phase!=='mentor'||s.notice)return false;s.phase='practice';return true;}
  };
  if(typeof module==='object'&&module.exports)module.exports=api;else globalThis.StarGuild=api;
})();
