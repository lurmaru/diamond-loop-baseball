/* Diamond Loop — deterministic simulation shared by the browser and tests. */
(function () {
  'use strict';
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
  const cap = s => 70 + 4*s.facility[2] + (s.manuals||0);
  const styles=['基礎の徹底','個別指導','実戦主義'];
  const combos=['投打の柱','黄金バッテリー','攻守一体'];
  const comboPairs=[[0,1],[1,2],[2,0]];
  function addLog(s, title, detail, type='note') {
    s.logs.unshift({year:s.year,title,detail,type});
    s.logs.length = Math.min(36,s.logs.length);
  }
  function player(s, slot, grade, fresh=false) {
    const genius = random(s)<0.045;
    const p={id:s.nextId++,name:pick(s,families)+' '+pick(s,names),slot,grade,genius,
      stats:[],traits:[0,0,0]};
    for(let k=0;k<3;k++){
      const aptitude = k===(slot===0?1:slot%3)?6:0;
      p.stats.push(Math.min(cap(s),22+int(s,12)+aptitude+grade*2+(genius?10:0)+s.facility[1]*2));
    }
    if (genius || (fresh && random(s)<0.2)) p.traits[int(s,3)]=1;
    return p;
  }
  function deal(s,first=false){
    s.cards=labels.map((l,k)=>{
      const r=random(s);
      const tier=first?(k===1?1:0):r<0.06?2:r<0.39?1:0;
      return {k,tier,name:training[k][tier]};
    });
  }
  function initial(seed=Date.now()){
    const s={version:1,rng:seed>>>0,year:1,week:0,phase:'practice',nextId:1,
      roster:[],cards:[],points:0,facility:[0,0,0],mastery:[0,0,0],policy:-1,
      focus:null,logs:[],titles:0,wins:0,games:0,best:0,challenge:0,record:0,
      match:null,options:[],report:null,graduates:[],heir:null,yearWins:0,skillPool:[],style:-1,manuals:0};
    for(let i=0;i<9;i++) s.roster.push(player(s,i,1+i%3));
    s.focus=s.roster[0].id;
    addLog(s,'新チーム始動','9人の部員と、最初の夏に挑もう。','spring');
    deal(s,true);
    return s;
  }
  function strength(s,k){
    const vals=s.roster.map(p=>p.stats[k]+3*p.traits[k]).sort((a,b)=>b-a);
    const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
    const ace=s.roster.find(p=>p.slot===0);
    return Math.round(k===1 && ace?avg*0.45+(ace.stats[1]+3*ace.traits[1])*0.55:avg*0.65+vals[0]*0.35);
  }
  const power=s=>Math.round(labels.reduce((a,_,k)=>a+strength(s,k),0)/3);
  function synergy(s,k){
    const ranks=comboPairs[k].map(a=>s.roster.reduce((sum,p)=>sum+p.traits[a],0));
    return {ranks,active:ranks.every(v=>v>=2)};
  }
  const gain=(s,c)=>2+c.tier+Math.floor(s.facility[0]/2)+(s.policy===c.k?1+Math.floor(Math.sqrt(s.mastery[c.k])/2):0);
  function setFocus(s,id){
    if(!s.roster.some(p=>p.id===id))return false;
    s.focus=id;return true;
  }
  function practice(s,k){
    if(s.phase!=='practice'||s.report||!s.cards[k])return false;
    const c=s.cards[k], g=gain(s,c), lead=s.roster.find(p=>p.id===s.focus)||s.roster[0];
    let total=0;
    for(const p of s.roster){
      const old=p.stats[k];
      const extra=2+s.facility[0]%2+(s.policy===k&&s.style===1?3:0);
      p.stats[k]=Math.min(cap(s),old+g+(p.id===lead.id?extra:0)+(p.genius?1:0));
      total+=p.stats[k]-old;
    }
    const awake=random(s)<(0.055+0.045*c.tier+(lead.genius?0.035:0)+(s.policy===k&&s.style===0?0.12:0));
    if(awake){ lead.traits[k]++;lead.stats[k]=Math.min(cap(s),lead.stats[k]+4); }
    s.week++;
    s.report={type:awake?'awake':'practice',title:awake?lead.name+' が覚醒！':c.name+' 完了',
      detail:awake?traits[k]+' Lv.'+lead.traits[k]+' を獲得。':labels[k]+'の合計成長 +'+total+'。重点選手は '+lead.name+'。',
      k,tier:c.tier};
    if(!awake && random(s)<0.017){
      s.manuals=(s.manuals||0)+1;s.points+=2;
      s.report={type:'manual',title:'黄金の指導書を発見！',detail:'学校の能力上限が永久に +1。さらに伝統Pt +2。',k,tier:2};
    }
    addLog(s,s.report.title,s.report.detail,s.report.type==='practice'?'train':'rare');
    if(s.week===1){s.phase='policy';s.options=[0,1,2].map(k=>({k,bonus:1+int(s,3),style:int(s,3)}));}
    else if(s.week===4||s.week===8){s.phase='skill';s.skillPool=[0,1,2].map(k=>({k,id:pick(s,s.roster).id,amount:random(s)<0.13?2:1}));}
    else if(s.week===6){startMatch(s,0);}
    else if(s.week===10){s.phase='graduate';s.graduates=s.roster.filter(p=>p.grade===3).map(p=>p.id);}
    else deal(s);
    return true;
  }
  function acknowledge(s){if(!s.report)return false;s.report=null;return true;}
  function choose(s,k){
    if(s.report||![0,1,2].includes(k))return false;
    if(s.phase==='policy'){
      s.policy=k;s.style=s.options[k].style;s.mastery[k]++;
      for(const p of s.roster)p.stats[k]=Math.min(cap(s),p.stats[k]+s.options[k].bonus);
      addLog(s,policies[k]+'を採用',labels[k]+'の練習に相乗効果。指導経験が残る。');
    }else if(s.phase==='skill'){
      const o=s.skillPool[k],p=s.roster.find(p=>p.id===o.id);
      p.traits[k]+=o.amount;
      addLog(s,p.name+' が'+traits[k]+'を習得','試合時の'+labels[k]+'評価が上昇。','rare');
    }else return false;
    s.phase='practice';deal(s);return true;
  }
  function startMatch(s,round){
    s.phase='match';
    const rivals=schools.filter(n=>!s.rivals?.includes(n));
    const opp=pick(s,rivals.length?rivals:schools);
    s.rivals=round===0?[opp]:[...(s.rivals||[]),opp];
    s.match={round,opp,level:44+round*7+8*s.challenge,
      us:0,them:0,step:0,scene:int(s,3),plays:[],finished:false};
  }
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
      s.points+=reward;
      if(won){s.wins++;s.yearWins++;s.best=Math.max(s.best,m.round+1);}
      if(won&&m.round===3){s.titles++;s.record=Math.max(s.record,s.challenge+1);}
      addLog(s,(won?'勝利':'敗戦')+'・'+rounds[m.round],m.us+' 対 '+m.them+'　'+m.opp+'｜伝統Pt +'+reward,won?'win':'game');
    }else m.scene=(m.scene+1+int(s,2))%3;
    return true;
  }
  function exitMatch(s){
    if(s.report||s.phase!=='match'||!s.match.finished)return false;
    const m=s.match;
    if(m.us>m.them && m.round<3)startMatch(s,m.round+1);
    else {s.phase='practice';s.match=null;deal(s);}
    return true;
  }
  function graduate(s,id){
    if(s.report||s.phase!=='graduate'||!s.graduates.includes(id))return false;
    const p=s.roster.find(p=>p.id===id);
    const keys=[0,1,2].sort((a,b)=>(p.traits[b]-p.traits[a])||(p.stats[b]-p.stats[a]));
    s.heir={name:p.name,k:keys[0],level:Math.max(1,Math.ceil(p.traits[keys[0]]/2))};
    const slots=s.roster.filter(v=>v.grade===3).map(v=>v.slot);
    s.roster=s.roster.filter(v=>v.grade<3);
    s.roster.forEach(v=>v.grade++);
    s.points+=3;addLog(s,'3人が卒業',p.name+'の技を新入生へ。伝統Pt +3。','spring');
    s.year++;s.week=0;s.yearWins=0;s.policy=-1;s.style=-1;s.phase='recruit';s.revealed=false;
    s.openSlots=slots;s.options=[0,1,2].map(()=>player(s,slots[0],1,true));return true;
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
    s.phase='practice';s.options=[];s.heir=null;deal(s);return true;
  }
  const cost=(s,k)=>4+s.facility[k]*3;
  function upgrade(s,k){
    if(![0,1,2].includes(k)||s.points<cost(s,k))return false;
    s.points-=cost(s,k);s.facility[k]++;
    addLog(s,['練習設備','スカウト網','育成研究室'][k]+'を強化','施設 Lv.'+s.facility[k]);return true;
  }
  function setChallenge(s,n){
    if(s.week>=6||s.phase!=='practice'||!Number.isInteger(n)||n<0||n>Math.max(s.record,s.year>=3?1:0))return false;
    s.challenge=n;return true;
  }
  const api={labels,policies,styles,traits,combos,comboPairs,synergy,pos,rounds,dates,situations,training,initial,cap,gain,strength,power,setFocus,practice,choose,acknowledge,odds,play,exitMatch,graduate,recruit,cost,upgrade,setChallenge};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else globalThis.DiamondGame=api;
})();
