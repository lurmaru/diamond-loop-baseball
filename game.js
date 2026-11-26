(function runGame() {
  'use strict';
  const G=DiamondGame, $=s=>document.querySelector(s);
  const KEY='diamond-loop.school.v1', PREF='diamond-loop.sound';
  const paths={
    home:'<path d="m3 10 9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    team:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 4 5"/>',
    flag:'<path d="M5 21V4m0 1c5-4 9 3 15 0l-2 5 2 3c-6 3-10-4-15 0"/>',
    book:'<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M9 3v18m3-13h5m-5 4h4"/>',
    gear:'<path d="m9 3 1-1h4l1 3 3 1 2 2-1 3 2 2-2 4-3 0-2 4h-4l-1-3-3-1-2-2 1-3-2-2 2-4h3z"/><circle cx="12" cy="11.5" r="3"/>',
    cards:'<path d="m5 6-3 2 3 12h10l2-2"/><rect x="7" y="3" width="13" height="15" rx="2"/><path d="m13.5 7 2.4 3-2.4 3-2.4-3z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M7 3v5m10-5v5"/>',
    trophy:'<path d="M7 3h10v6c0 7-10 7-10 0zM7 5H3v2c0 3 2 5 5 5m9-7h4v2c0 3-2 5-5 5m-4 2v5m-4 2h8"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
    chart:'<path d="M3 20h18M5 16v-4h3v4zm6 0V8h3v8zm6 0V4h3v12z"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    diamond:'<path d="m12 2 10 10-10 10L2 12z"/><path d="m6 12 6 6 6-6"/>',
    bat:'<path d="m5 19 5-6m-2 2 3 2m-1-4L17 4c2-3 6 0 4 2l-9 9zm-7 7 3 2"/>',
    ball:'<circle cx="12" cy="12" r="9"/><path d="M7 5q7 6 1 14m8-15q-5 8 4 13"/>',
    glove:'<path d="m8 12-2-5c-1-2-3-1-2 1l2 8c1 5 8 7 12 2l3-6c1-2-1-3-2-2l-2 3 1-8c0-2-2-2-3 0l-1 6V4c0-2-3-2-3 0v7L9 5c-1-2-3-1-2 1z"/>'
  };
  const ico=(k)=>`<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${paths[k]||paths.diamond}</svg>`;
  const filenames=['batting','pitching','fielding'];
  const tones=['var(--gold)','var(--cyan)','var(--mint)'];
  const acts=['bat','ball','glove'];
  const rarity=['N','R','SR'];
  const tabs=[['home','育成ホーム'],['team','選手名鑑'],['flag','強化施設'],['book','部誌']];
  const facilityNames=['練習設備','スカウト網','育成研究室'];
  const versionOK=v=>v && v.version===1 && Array.isArray(v.roster)&&v.roster.length>=6 && Array.isArray(v.logs)&&Array.isArray(v.facility) && Number.isInteger(v.rng) && ['practice','match','graduate','recruit','skill','policy'].includes(v.phase);
  let state,warning='',sound=false,context,tab='home',timer,dialogKind='';
  try{const raw=localStorage.getItem(KEY);if(raw){state=JSON.parse(raw);if(!versionOK(state))throw Error();}sound=localStorage.getItem(PREF)==='on';}
  catch{warning='保存データを読み込めませんでした。';state=null;}
  if(!state)state=G.initial(crypto.getRandomValues(new Uint32Array(1))[0]);
  function save(){
    try{localStorage.setItem(KEY,JSON.stringify(state));$('#save').textContent='自動保存';$('#save').classList.remove('failed');}
    catch{$('#save').textContent='保存不可';$('#save').classList.add('failed');tell('このブラウザでは進行を保存できません。');}
  }
  function tell(message){const t=$('#toast');t.textContent=message;t.classList.add('on');clearTimeout(timer);timer=setTimeout(()=>t.classList.remove('on'),2600);}
  function chime(rare=false){
    if(!sound)return;
    try{context||=new (window.AudioContext||window.webkitAudioContext)();context.resume().catch(()=>{});const start=context.currentTime;
      (rare?[523,659,784,1046]:[440,659]).forEach((f,i)=>{const o=context.createOscillator(),g=context.createGain();o.type='triangle';o.frequency.value=f;const t=start+i*.07;g.gain.setValueAtTime(.045,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.connect(g).connect(context.destination);o.start(t);o.stop(t+.16);});}catch{}
  }
  const button=(act,n,title,cls='choice',disabled=false)=>`<button class="${cls}" data-act="${act}" data-n="${n}" ${disabled?'disabled':''}>${title}</button>`;
  const description=(name,desc,end='')=>`<span><strong>${name}</strong><small>${desc}</small></span>${end?'<b>'+end+'</b>':''}`;
  const focused=()=>state.roster.find(p=>p.id===state.focus)||state.roster[0];
  const styleText=['方針に合う練習で覚醒率 +12ポイント','方針に合う練習で重点選手の成長 +3','方針に合う采配で試合評価をさらに +3'];
  const season=()=>state.phase==='match'?'夏':state.phase==='graduate'?'春':state.week<4?'春':state.week<6?'初夏':state.week<8?'秋':'冬';
  function hero(){
    const s=state, date=s.phase==='match'?'7月 大会期間':s.phase==='graduate'?'3月 卒業式':G.dates[s.week]||'4月 第1週';
    const next=s.phase==='match'?`夏の大会 <strong>${G.rounds[s.match.round]}</strong>`:s.week<6?`夏の地区予選まで <strong>あと${6-s.week}回の練習</strong>`:`次の世代交代まで <strong>あと${10-s.week}回の練習</strong>`;
    return `<section class="hero" aria-label="シーズン情報"><div class="hero-inner"><span class="season">${ico('flag')} ${s.year}年目</span><h1>青葉高校 野球部</h1><p class="hero-date">${ico('calendar')}${date}<i></i>${season()}の${s.phase==='match'?'大会':s.phase==='graduate'?'卒業式':'育成'}</p><p class="goal-line">${ico('trophy')}${next}</p></div><span class="hero-weather">${ico('sun')}晴れ</span></section>`;
  }
  const head=(ic,title,en,chip='')=>`<div class="sectionhead"><div class="heading-icon">${ico(ic)}</div><div><div class="eyebrow">${en}</div><h2>${title}</h2></div>${chip?`<span class="step">${chip}</span>`:''}</div>`;
  function bar(k,v){return `<div class="statrow"><span>${G.labels[k]}</span><div class="track"><i style="width:${Math.min(100,100*v/G.cap(state))}%;background:${tones[k]}"></i></div><b>${v}</b></div>`;}
  function logs(list){return `<ul class="journal">${list.map(l=>`<li><i></i><div><span class="yr">${l.year}年目</span><strong>${l.title}</strong><small>${l.detail}</small></div></li>`).join('')}</ul>`;}
  function aside(){
    const active=G.combos.filter((_,k)=>G.synergy(state,k).active).length;
    const combos=`<details class="combo"><summary>連携スキル <b>${active} / 3</b></summary>${G.combos.map((v,k)=>{
      const syn=G.synergy(state,k);
      return `<div><strong>${v} ${syn.active?'・発動中':''}</strong><small>${G.comboPairs[k].map((a,i)=>G.traits[a]+' '+Math.min(2,syn.ranks[i])+'/2').join(' ＋ ')}で${G.labels[k]}の試合評価 +5</small></div>`;
    }).join('')}</details>`;
    return `<aside class="side"><section class="sidebox"><h2>${ico('chart')}チーム戦力</h2><div class="rating"><span>総合力</span><b>${G.power(state)}</b></div>${G.labels.map((_,k)=>bar(k,G.strength(state,k))).join('')}<div class="sidefoot"><span>指導方針</span><b>${G.policies[state.policy]||'未選択'}${state.policy>=0&&G.styles[state.style]?'・'+G.styles[state.style]:''}</b></div>${combos}</section><section class="sidebox"><h2>${ico('book')}監督ノート</h2>${logs(state.logs.slice(0,2))}</section></aside>`;
  }
  function practiceBoard(){
    return head('cards','練習を選択','TRAINING DECK',`手札 ${state.cards.length} 枚`)+`<p class="hint">今週の練習を1枚選んで、チームを育てよう。</p><div class="cards">${state.cards.map(c=>{
      const k=c.k;
      return `<button class="card tone${k} ${c.tier===2?'shine':''}" data-act="practice" data-n="${k}" aria-label="${c.name}、${G.labels[k]}プラス${G.gain(state,c)}"><span class="card-art"><span class="rarity">${rarity[c.tier]}</span><span class="stars" aria-hidden="true">${'★'.repeat(c.tier+1)}</span><img src="./assets/${filenames[k]}.png" alt=""></span><span class="card-body"><strong>${c.name}</strong><small>${['打線を鍛える','投手を鍛える','守りを鍛える'][k]}</small><span class="effect"><span>${ico(acts[k])} ${G.labels[k]}</span><b>+${G.gain(state,c)}</b></span></span></button>`;
    }).join('')}</div><div class="focusline">${ico('target')}重点育成 <strong>${focused().name}</strong>${button('tab',1,'変更','linkbtn')}</div>`;
  }
  function choices(title,en,hint,arr,act){
    return head('cards',title,en)+`<p class="hint">${hint}</p><div class="options in">${arr.map((v,i)=>button(act,i,v)).join('')}</div>`;
  }
  function matchBoard(){
    const m=state.match,done=m.finished;
    const frame=m.step<3?['3回','6回','9回'][m.step]:`延長${m.step+7}回`;
    const prev=m.plays.at(-1);
    const champion=done&&m.round===3&&m.us>m.them;
    const tactics=['強振を指示','投手で勝負','守備を固める'];
    return head('trophy',G.rounds[m.round],'SUMMER TOURNAMENT',state.challenge?'名門戦 Lv.'+state.challenge:'夏季大会')+
      `<div class="score"><span>青葉高校<small>自校</small></span><b>${m.us} – ${m.them}</b><span>${m.opp}<small>相手戦力 ${m.level}</small></span></div>`+
      (prev?`<p class="playlog">${prev.success?'采配成功':'相手が優勢'} ・ この攻防で ${prev.runs}得点 / ${prev.against}失点</p>`:'')+
      (done?`<div class="scene ${champion?'champion':''}">${champion?ico('trophy'):''}<h3>${m.us>m.them?(m.round===3?'全国優勝！':'青葉高校の勝利！'):'夏の大会 終了'}</h3><p>${state.logs.find(v=>v.type==='win'||v.type==='game')?.detail||''}</p></div>`+button('exitMatch',0,m.us>m.them&&m.round<3?'次の試合へ':'秋の練習へ','primary'):
      `<div class="scene"><h3>${frame}・${G.situations[m.scene][0]}</h3><p>${G.situations[m.scene][1]}</p></div><div class="options">${tactics.map((v,k)=>button('play',k,description(ico(acts[k])+' '+v,`${['長打狙い・失点リスク大','投打のバランス重視','失点を抑える・得点少'][k]}${state.policy===k?' ／ 方針一致':''}`,`成功 ${Math.round(100*G.odds(state,k))}%`))).join('')}</div>`);
  }
  function board(){
    const s=state;
    if(s.phase==='practice')return practiceBoard();
    if(s.phase==='match')return matchBoard();
    if(s.phase==='policy')return choices('今年の指導方針','COACHING POLICY','今季の練習と試合を強化。採用経験は来年以降にも蓄積される。',s.options.map(o=>description(G.policies[o.k]+'・'+G.styles[o.style],`${G.labels[o.k]}の練習と試合を強化。${styleText[o.style]}。`,`全員 +${o.bonus}`)),'choose');
    if(s.phase==='skill')return choices('特殊能力を選択','SKILL DRAFT','ひとりに特殊能力を授けよう。1レベルにつき対応する試合評価が3上がる。',s.skillPool.map(o=>description(G.traits[o.k],`${s.roster.find(p=>p.id===o.id).name} ｜ ${G.labels[o.k]}系`, `Lv +${o.amount}`)),'choose');
    if(s.phase==='graduate')return choices('卒業生から継承','LEGACY','新入生に技を託す卒業生を1人選ぼう。最も熟練した特殊能力を引き継ぐ。',s.graduates.map(id=>{
      const p=s.roster.find(v=>v.id===id),k=[0,1,2].sort((a,b)=>p.traits[b]-p.traits[a]||p.stats[b]-p.stats[a])[0];return description(p.name,G.pos[p.slot],G.traits[k]+' Lv.'+Math.max(1,Math.ceil(p.traits[k]/2)));
    }),'graduate');
    if(!s.revealed){
      const rare=s.options.some(p=>p.genius);
      return head('diamond','新入生スカウト','FRESHMAN SCOUT')+`<div class="scout ${rare?'rainbow':''}"><div class="packs" aria-hidden="true"><i>◆</i><i>◆</i><i>◆</i></div><h3>${rare?'虹の輝き……天才の予感！':'新入生候補が到着！'}</h3><p>届いた3枚の選手カードを開こう。</p>${button('reveal',0,'3枚を一斉に開封','primary')}</div>`;
    }
    return choices('新入生を指名','FRESHMAN SCOUT',`重点育成する1人を選択。ほか2人も入部し、${s.heir.name}の「${G.traits[s.heir.k]}」を指名選手が継承する。`,s.options.map(p=>description(p.name+(p.genius?' ★天才':''),G.labels.map((l,k)=>l+' '+p.stats[k]).join(' ／ '),G.pos[p.slot])),'recruit');
  }
  function team(){
    const s=state;
    return `<section class="page-panel">${head('team','選手名鑑','TEAM ROSTER',s.roster.length+'人')}<p class="hint">重点育成の選手には、練習のたびに追加で能力 +2。</p><div class="roster">${s.roster.map(p=>`<article class="person ${p.id===s.focus?'active':''}"><div class="person-head"><span class="chip">${p.grade}年・${G.pos[p.slot]}</span>${p.genius?'<b class="chip hot">天才</b>':''}</div><h3>${p.name}</h3>${p.stats.map((v,k)=>bar(k,v)).join('')}<div class="talents">${p.traits.map((v,k)=>v?G.traits[k]+' Lv.'+v:'').filter(Boolean).join(' ／ ')||'特殊能力 未習得'}</div>${button('focus',p.id,p.id===s.focus?'重点育成中':'重点育成に指定','pill',p.id===s.focus)}</article>`).join('')}</div></section>`;
  }
  function facilities(){
    const s=state,max=Math.max(s.record,s.year>=3?1:0);
    return `<div class="page-grid"><section class="page-panel">${head('flag','強化施設','CLUB FACILITIES',s.points+' 伝統Pt')}<p class="hint">試合と卒業で得た伝統Ptを使い、学校を恒久強化。</p>${facilityNames.map((l,k)=>`<article class="upgrade"><div class="itemrow"><h3>${l}</h3><b class="accent">Lv.${s.facility[k]}</b></div><p class="quiet">${['奇数レベルで重点選手の成長 +1。偶数レベルでその効果が全員に広がる。','1レベルごとに新入生の初期能力 +2。','1レベルごとに能力上限 +4。現在の上限 '+G.cap(s)+'。'][k]}</p>${button('upgrade',k,G.cost(s,k)+' Pt で強化','secondary',s.points<G.cost(s,k))}</article>`).join('')}</section><section class="page-panel">${head('trophy','名門への挑戦','CHALLENGE LEAGUE')}<p class="quiet">全国優勝または3年目で解放。名門戦ではレベルごとに相手戦力 +8、勝利時の伝統Pt +1。優勝で次のレベルに挑戦できる。</p><div class="itemrow space"><b>今季の難易度</b><span class="chip">${s.challenge?'名門戦 Lv.'+s.challenge:'通常大会'}</span></div>${max?`<label>大会選択 <select id="difficulty" ${s.week>=6||s.phase!=='practice'?'disabled':''}>${Array.from({length:max+1},(_,i)=>`<option value="${i}" ${i===s.challenge?'selected':''}>${i?'名門戦 Lv.'+i:'通常大会'}</option>`).join('')}</select></label><p class="quiet space">大会前の練習期間に変更できます。</p>`:'<span class="chip">未解放</span>'}<h3 class="space">歴代の指導経験</h3>${G.policies.map((l,k)=>`<div class="sidefoot">${l}<b>${s.mastery[k]} 回採用</b></div>`).join('')}</section></div>`;
  }
  function journalPage(){
    return `<section class="page-panel logpage">${head('book','野球部の記録','CLUB JOURNAL',state.year+'年目')}<div class="itemrow space"><span>公式戦 <b>${state.wins}勝 ${state.games-state.wins}敗</b></span><span class="accent">全国優勝 ${state.titles}回</span></div><p class="quiet">直近36件の監督ノート</p>${logs(state.logs)}</section>`;
  }
  function render(){
    $('#nav').innerHTML=tabs.map(([key,name],i)=>`<button class="nav-btn" data-act="tab" data-n="${i}" aria-current="${tab===key?'page':'false'}">${ico(key)}<span>${name}</span></button>`).join('');
    $('#main').innerHTML=hero()+(tab==='home'?`<div class="layout"><section class="board">${board()}</section>${aside()}</div>`:tab==='team'?team():tab==='flag'?facilities():journalPage());
    if(state.report && !$('#modal').open)report();
  }
  function openDialog(kind,html){dialogKind=kind;$('#modal-body').innerHTML=html;if(!$('#modal').open)$('#modal').showModal();}
  function report(){
    const r=state.report;
    openDialog('report',`<div class="reveal"><div class="eyebrow">${({awake:'AWAKENING',genius:'GENIUS SCOUT',scout:'NEW GENERATION',manual:'GOLDEN MANUAL'})[r.type]||'TRAINING RESULT'}</div><img src="./assets/${filenames[r.k]}.png" alt=""><h2 id="modal-title">${r.title}</h2><p>${r.detail}</p>${button('ack',0,'チームに戻る','primary')}</div>`);
  }
  function settings(){
    openDialog('settings',`<h2 id="modal-title">設定と遊び方</h2><p>練習カードを選んで能力を伸ばし、夏の4試合を勝ち抜こう。各選手の在籍期間は3年間。選手名鑑で重点選手をいつでも変更できます。</p><p>金色の光が走るSRカードは大きく成長するチャンス。覚醒や特殊能力は試合で力を発揮し、世代交代で新入生に引き継げます。</p><div class="settings-row">効果音${button('sound',0,sound?'オン':'オフ','pill')}</div><p class="quiet">進行はこのブラウザに自動保存されます。サイトデータを消去すると記録も消えます。</p>${button('close',0,'閉じる','primary')}`);
  }
  function navigate(i){tab=tabs[i][0];render();window.scrollTo({top:0,behavior:'instant'});}
  document.addEventListener('click',event=>{
    const b=event.target.closest('button[data-act]');if(!b||b.disabled)return;
    const act=b.dataset.act,n=Number(b.dataset.n),s=state;
    if(act==='tab'){navigate(n);return;}
    if(act==='close'){$('#modal').close();return;}
    if(act==='sound'){sound=!sound;try{localStorage.setItem(PREF,sound?'on':'off');}catch{}chime();settings();return;}
    let changed=false,msg='';
    switch(act){
      case 'practice':changed=G.practice(s,n);if(changed&&s.report.type==='practice'){msg=s.report.detail;G.acknowledge(s);}break;
      case 'choose':changed=G.choose(s,n);msg=s.logs[0].title;break;
      case 'play':changed=G.play(s,n);break;
      case 'exitMatch':changed=G.exitMatch(s);break;
      case 'graduate':changed=G.graduate(s,s.graduates[n]);break;
      case 'reveal':if(s.phase==='recruit'&&!s.revealed){s.revealed=true;changed=true;}break;
      case 'recruit':changed=G.recruit(s,n);break;
      case 'upgrade':changed=G.upgrade(s,n);msg=s.logs[0].title;break;
      case 'focus':changed=G.setFocus(s,n);msg=focused().name+'を重点育成に指定';break;
      case 'ack':changed=G.acknowledge(s);$('#modal').close();break;
    }
    if(changed){save();chime(!!s.report||s.match?.finished);render();if(msg)tell(msg);}
  });
  document.addEventListener('change',e=>{if(e.target.id==='difficulty'&&G.setChallenge(state,Number(e.target.value))){save();render();tell('今季の大会を変更しました');}});
  $('#settings').innerHTML=ico('gear');$('#settings').onclick=settings;
  $('#brand').onclick=()=>navigate(0);
  $('#modal').addEventListener('cancel',e=>{if(dialogKind==='report'){e.preventDefault();G.acknowledge(state);save();$('#modal').close();render();}});
  save();render();if(warning)tell(warning);
})();
