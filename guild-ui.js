(function(){
  'use strict';
  const G=globalThis.StarGuild,{D,Y}=G,$=q=>document.querySelector(q);
  const art='./assets/guild/',base='starfall.guild.v1',paths={
    home:'M3 11 12 3l9 8v9H3z M9 20v-7h6v7',people:'M5 20v-2a5 5 0 0 1 10 0v2 M18 12a4 4 0 0 1 3 4v3 M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
    hall:'M3 21h18 M5 21V10l3 2 4-6 4 6 3-2v11 M10 21v-6h4v6 M12 6V2l5 2-5 2',book:'M4 3h6l2 2 2-2h6v16h-6l-2 2-2-2H4z M12 5v16',
    star:'m12 2 2.3 6.9L21 12l-6.7 2.5L12 22l-2.5-7.5L3 12l6.6-3z',compass:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M15.8 8.2l-2 5.6-5.6 2 2-5.6z',
    sword:'M4 20 16 8 M3 16l5 5 M7 14l3 3L20 7l1-5-5 1z',magic:'M4 21 15 10 M12 5l4-3 4 3-1 5-4 2-3-3z M5 4v4 M3 6h4',
    trail:'M2 18c3-7 8 3 12-3s-1-9 4-12 M8 19l2-3 M13 6l3 1 M20 7l2-2',gear:'M3 6h10m4 0h4 M3 12h3m5 0h10 M3 18h11m5 0h2 M13 3v6 M7 9v6 M15 15v6',
    coin:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0z M12 8l3 4-3 4-3-4z',flag:'M5 21V3l7 2 7-2v10l-7 2-7-2',
    cards:'M4 5 15 2l4 14 M7 7h13v15H7z M10 14l3-3 3 3-3 3z',moon:'M20 14a8 8 0 0 1-11-10 9 9 0 1 0 11 10z'
  };
  const ico=(key)=>'<svg class="ico" aria-hidden="true" viewBox="0 0 24 24"><path d="'+paths[key]+'"/></svg>';
  const signs=['sword','magic','trail'],acts=['剣撃','星術','迎撃'];
  const text=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const button=(act,n,label,cls='choice',off=false)=>'<button class="'+cls+'" data-act="'+act+'" data-n="'+n+'"'+(off?' disabled':'')+'>'+label+'</button>';
  const line=(a,b)=>'<span><strong>'+a+'</strong><small>'+b+'</small></span>';
  const heading=(icon,title,meta='')=>'<div class="heading"><h2>'+ico(icon)+title+'</h2>'+(meta?'<span>'+meta+'</span>':'')+'</div>';
  let slot=1,s,tab=0,timer,settings=false,saveError=false,sound=false,audio;
  try{sound=localStorage.getItem(base+'.sound')==='on';}catch{}
  function chime(rare){
    if(!sound)return;
    try{
      audio??=new AudioContext();if(audio.state==='suspended')audio.resume().catch(()=>{});
      for(const [i,f] of (rare?[440,554,659,880]:[523,659]).entries()){
        const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+i*.085;
        osc.type='sine';osc.frequency.value=f;gain.gain.setValueAtTime(.0001,t);
        gain.gain.exponentialRampToValueAtTime(.06,t+.012);gain.gain.exponentialRampToValueAtTime(.0001,t+.22);
        osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.23);
      }
    }catch{}
  }
  const key=n=>base+'.'+n;
  const fresh=()=>G.initial(crypto.getRandomValues(new Uint32Array(1))[0]);
  function read(n){const raw=localStorage.getItem(key(n));if(!raw)return fresh();const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.roster)||!Array.isArray(data.pack))throw Error();return data;}
  try{slot=Number(localStorage.getItem(base+'.active'))===2?2:1;s=read(slot);}catch{s=fresh();saveError=true;}
  function save(){
    try{if(saveError)throw Error();localStorage.setItem(key(slot),JSON.stringify(s));localStorage.setItem(base+'.active',String(slot));$('#save').textContent='自動保存';}
    catch{$('#save').textContent='保存できません';}
  }
  function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('on');clearTimeout(timer);timer=setTimeout(()=>$('#toast').classList.remove('on'),2300);}
  const portrait=(p,cls='portrait')=>'<img class="'+cls+'" src="'+art+'role-'+p.role+'.webp" alt="'+G.roles[p.role][0]+'">';
  const rank=p=>'<span class="rank r'+p.rank+'">'+G.ranks[p.rank]+'</span>';
  const phaseTitles={intake:'春の契約式',practice:'修練の旅路',camp:'星見の野営',build:'修練デッキの組み替え',oath:'旅団の誓い',evolve:'修練札の進化',mentor:'先達の帰還',shop:'街道の市集',event:'古き祠',friendly:'街道の小依頼',loot:'依頼の報酬',succession:'契約満了',prepare:'遠征の支度',battle:'遠征中',result:'戦闘の記録'};
  const focused=()=>s.roster.find(p=>p.id===s.focus);
  function hero(){
    const intro=s.phase==='intake'&&tab===0;
    return '<section class="hero '+(intro?'opening':'')+'"><div><span class="stamp">'+ico('compass')+' 灯守の谷</span><h1>'+(intro?'星灯りの旅団':tab===0?phaseTitles[s.phase]:['','冒険者名鑑','ギルドの拠点','冒険の記録'][tab])+'</h1><p>'+(intro?'冒険者を迎え、修練札で育て、星喰いの竜が眠る谷へ。':s.year+'年目　'+Y.date(s.day)+'　／　'+(s.oath<0?'灯守のギルド':G.oaths[s.oath]))+'</p></div></section>';
  }
  function recruit(){
    const p=s.pack[s.drawn-1],all=s.drawn===s.pack.length;
    const face=p?'<div class="tarot face rarity'+p.rank+'" data-id="'+p.id+'">'+portrait(p,'full-art')+rank(p)+'<div class="caption"><small>'+G.roles[p.role][0]+'</small><b>'+text(p.name)+'</b></div></div>':'<div class="tarot back '+(s.pack.some(v=>v.rank>=3)?'glow':'')+'"><div class="book-edge"></div><img src="'+art+'star.svg" alt=""><span>契約の星印</span></div>';
    const pick=s.pack.map((v,i)=>i<s.drawn?button('accept',v.id,portrait(v)+line(text(v.name),G.roles[v.role][0])+rank(v),'person-pick rarity'+v.rank,!all):'<div class="person-pick sealed">'+ico('star')+line('未開封','契約書 '+(i+1))+'</div>').join('');
    return '<div class="sheet draw">'+heading('star','春の契約式',s.drawn+' / '+s.pack.length+' 通')+'<div class="drawstage">'+face+'<div><span class="over">第'+s.year+'期　冒険者募集</span><h3>'+(p?text(p.name)+'の契約書':'星印の契約書')+'</h3><p>'+(p?G.roles[p.role][0]+'の心得<br>'+G.roles[p.role][1]:'谷のギルドに3通の契約書が届きました。封を開けて、新しい仲間に会いましょう。')+'</p>'+(!all?button('reveal',0,'封をひとつ開く','primary')+button('reveal',1,'まとめて開封','link'):'<b class="prompt">重点育成する1人を下から選択</b>')+'</div></div><div class="picklist">'+pick+'</div><p class="note">全員が加入します。重点育成する1人は修練の経験が増えます。'+(s.heir?' 選んだ人に'+text(s.heir.name)+'の「'+G.arts[s.heir.k]+'」を継承。':'')+'</p></div>';
  }
  function seasonPlan(){
    const rows=[['policy','旅団の誓い'],['summerCamp','初夏の野営'],['summer','夏の大遠征'],['autumn','星門の試練'],['alumni','先達の帰還'],['winterCamp','冬の野営'],['rumor','旅人の噂'],['spring','星塔遠征（星門突破時）'],['end','契約満了']];
    return '<details class="plan"><summary>旅団の年間予定</summary><ul>'+rows.map(([k,v])=>'<li><span>'+Y.date(Y.events[k])+'</span>'+v+'</li>').join('')+'</ul></details>';
  }
  function map(){
    const count=Math.min(9,365-s.day);
    return '<div class="route"><div class="routehead"><b>'+ico('compass')+' 街道の暦</b><span>'+ico('coin')+' '+s.gold+' G</span></div><div class="tiles">'+Array.from({length:count},(_,i)=>{
      const k=s.tiles[s.day+i],mark={plain:'·',good:'✦',bad:'☂',shop:'◇',event:'♧',friendly:'⚑',camp:'☾'}[k]||'★';
      return '<div class="tile '+(i?'':'current ')+'t-'+k+'" data-day="'+(s.day+i)+'"><small>'+(i?Y.date(s.day+i):'現在地')+'</small><b>'+mark+'</b><small>'+G.tileNames[k]+'</small></div>';
    }).join('')+'</div></div>';
  }
  function card(c,i,mode){
    const training=mode==='train',camp=mode==='camp',sel=mode==='toggle'&&s.draft.includes(c.id);
    const d=training?G.distance(s,c):c.steps,meta=D.detail(c);
    const hint=training?(G.credit(s,c)>=9?'大きく':G.credit(s,c)>=5?'着実に':'軽く')+'鍛える ・ '+G.tileNames[s.tiles[Y.landing(s,c)]]:camp?G.arts[c.k]+(c.mentor?' ・ 直伝':'の習得に挑む'):G.fields[c.k]+'の修練';
    return '<button class="drill k'+c.k+(sel?' selected':'')+'" data-act="'+mode+'" data-n="'+i+'" '+(training?'data-day="'+Y.landing(s,c)+'"':'')+(mode==='toggle'?' aria-pressed="'+sel+'"':'')+'><span class="cardtop"><b>'+D.rarity(c)+'</b><small>'+G.fields[c.k]+'</small><span>'+(sel?'✓ 採用　':'')+d+'日</span></span><span class="sigil">'+ico(signs[c.k])+'</span><strong>'+text(c.name)+'</strong><small>'+hint+'</small>'+(meta?'<small class="mod">'+text(meta)+'</small>':'')+'</button>';
  }
  function practice(){
    const camp=s.phase==='camp',p=focused();
    return '<div class="sheet">'+map()+heading(camp?'moon':'cards',camp?'星見の野営':'修練札を選ぶ','手札 '+s.cards.length+'枚')+'<p class="hint">'+(camp?text(p.name)+'が選んだ札の奥義を学びます。直伝札なら習得の好機。':'短い札で街道に立ち寄り、長い札でじっくり鍛えます。')+'</p><div class="hand">'+s.cards.map((c,i)=>card(c,i,camp?'camp':'train')).join('')+'</div>'+(camp?'':'<div class="between">'+button('auto',0,'おまかせ修練','secondary')+'<small>最長15日 ・ 行事で停止</small></div>')+(s.last?'<p class="last">'+text(s.last)+'</p>':'')+seasonPlan()+'</div>';
  }
  const bless={study:'修練経験をさらに増やす',journey:'遠征開始時の最大体力 +5',wealth:'誓いを立てると金貨 +14'};
  function choices(title,icon,hint,options){return '<div class="sheet">'+heading(icon,title)+'<p class="hint">'+hint+'</p><div class="choices">'+options.join('')+'</div></div>';}
  function build(){return '<div class="sheet">'+heading('cards','修練デッキを組む',s.draft.length+'枚')+'<p class="hint">'+(s.buildWindow==='summer'?'夏の大遠征を終えました。':'新たな仲間がそろいました。')+' 修練帳から'+D.minimum(s)+'枚以上を採用します。次の編成は'+(s.buildWindow==='summer'?'春の契約式':'夏の遠征後')+'です。</p>'+button('lock',0,'このデッキで出発','primary',s.draft.length<D.minimum(s))+'<div class="hand catalog">'+s.library.map(c=>card(c,c.id,'toggle')).join('')+'</div></div>';}
  function visit(){
    const shop=s.phase==='shop',loot=s.phase==='loot';
    if(shop||loot){
      const opts=s.offers.map((id,i)=>{const c=D.make(id),owned=D.card(s,id);return button('visit',i,line(c.name,D.rarity(c)+' ・ '+G.fields[c.k]+' ・ '+c.steps+'日')+'<b>'+(owned?'登録済':shop?G.price(id)+' G':'入手')+'</b>','choice',owned||(shop&&s.gold<G.price(id)));});
      if(shop)opts.unshift(button('visit',4,line('手札を永久に1枠増やす','現在 '+s.handSize+'枠')+'<b>'+D.slotPrice(s)+' G</b>','choice',s.gold<D.slotPrice(s)||s.handSize>=s.deck.length-1));
      if(shop)opts.push(button('visit',5,line('星灯のランタンを補強','遠征の最大体力を永久に +2。現在 +'+2*(s.lantern||0))+'<b>'+G.lanternPrice(s)+' G</b>','choice',s.gold<G.lanternPrice(s)));
      opts.push(button('visit',3,'街道に戻る','secondary'));
      return choices(shop?'街道の市集':'依頼の報酬',shop?'coin':'star',(shop?'所持金 '+s.gold+' G。':'依頼達成。未登録の札を1枚受け取れます。')+' 新しい札は次のデッキ編成で採用できます。',opts);
    }
    if(s.phase==='event')return choices('古き祠','moon','祠の世話をして謝礼を受け取るか、石碑から奥義を学びます。',[button('visit',0,line('祠を修繕','金貨 +8')),button('visit',1,line('石碑を読み解く',text(focused().name)+'が「'+G.arts[D.card(s,s.eventCard).k]+'」を学ぶ機会'))]);
    return choices('街道の小依頼','flag','旅の商隊からの依頼。今回は'+G.fields[s.weak]+'が役立ちそうです。',G.fields.map((v,i)=>button('visit',i,line(v+'で解決する',i===s.weak?'依頼と好相性':'実力で挑む')+ico(signs[i]))));
  }
  function memberList(){return G.party(s).map(p=>'<div class="crew">'+portrait(p)+line(text(p.name),G.roles[p.role][0])+rank(p)+'</div>').join('');}
  function health(label,value,max,cls){
    return `<div class="health ${cls}"><span>${label}<b>${value} / ${max}</b></span><progress max="${max}" value="${value}"></progress></div>`;
  }
  function fightControls(e){
    const tips=['次は強烈な一撃。迎撃で受け流せる。','物理攻撃を防ぐ。星術なら貫通できる。','守りが薄い。どの戦技も威力上昇。'];
    const moves=['剣で攻め、星力 +1','結界を貫き、味方を小回復','被害を抑えて反撃し、星力 +2'];
    const buttons=acts.map((v,k)=>{
      const tag=k===1?'星力 2':k===e.foe?'弱点':'';
      return button('strike',k,ico(signs[k])+line(v,moves[k])+'<b>'+tag+'</b>','choice k'+k,k===1&&e.mp<2);
    });
    return `${health('旅団の体力',e.hp,e.maxHP,'hp')}${health('敵の体力',e.enemyHP,e.enemyMax,'enemy')}
      <div class="tell"><b>${ico('compass')} 敵の予兆　${G.intents[e.intent]}</b><small>${tips[e.intent]}${e.open?'　看破中。次撃強化。':''}</small></div>
      <div class="between"><b>戦技を選ぶ</b><span>${ico('star')} 星力 ${e.mp} / 6</span></div>
      <div class="choices">${buttons.join('')}</div>
      ${e.last?'<p class="last">'+text(e.last)+'</p>':''}`;
  }
  function fightResult(e){
    const title=!e.won?'旅団は撤退した':!e.finished?'守護者を突破！':e.kind==='autumn'?'星門が開いた！':'遠征踏破！';
    const reward=e.kind==='autumn'?'3月1日、星塔への道が開きます。':'灯冠を入手。拠点で次の深度に挑めます。';
    const exit=e.finished?button('advance',0,'遠征を終える','primary'):
      '<h3>道中の戦利品を選ぶ</h3><div class="choices">'+e.rewards.map((r,i)=>button('advance',i,line(...G.relics[r]))).join('')+'</div>';
    return `<h3 class="outcome">${title}</h3><p>${text(e.last)}</p>
      <p class="last">${text(e.summary)} 功績 +${e.won?2:1}。</p>
      ${e.won&&e.finished?'<p class="hint">'+reward+'</p>':''}${exit}`;
  }
  function battle(){
    const e=s.expedition,prep=s.phase==='prepare';
    const foe=prep?(e.kind==='autumn'?1:2):e.foe;
    let body;
    if(prep){
      body=`<p class="hint">全${G.lengths[e.kind]}戦。道中では体力と星力を引き継ぎ、戦利品を1つ選べます。</p>
        <div class="squad">${memberList()}</div>
        <div class="actions">${button('launch',0,'遠征に出発','primary')}${button('tab',1,'出撃隊を編成','secondary')}</div>`;
    }else body=s.phase==='result'?fightResult(e):fightControls(e);
    return `<div class="sheet fight">
      ${heading('flag',G.expeditions[e.kind],'深度 '+(e.depth+1))}
      <div class="foe"><img src="${art}foe-${foe}.webp" alt="">
        <div><small>${prep?'最深部の守護者':(e.floor+1)+' / '+G.lengths[e.kind]+' 区画'}</small>
          <h3>${G.enemies[foe][0]}</h3><p>${G.enemies[foe][1]}</p></div>
      </div>${body}
    </div>`;
  }
  function mainBoard(){
    if(s.phase==='intake')return recruit();
    if(['practice','camp'].includes(s.phase))return practice();
    if(s.phase==='build')return build();
    if(s.expedition)return battle();
    if(['shop','loot','event','friendly'].includes(s.phase))return visit();
    if(s.phase==='oath')return choices('今年の誓いを選ぶ','star','選んだ系統の修練と戦技を強化します。祝福の組み合わせは年ごとに変わります。',G.oaths.map((v,i)=>button('oath',i,line(v,bless[s.blessings[i]])+ico(signs[i]))));
    if(s.phase==='mentor'||s.phase==='evolve'){
      const m=s.phase==='mentor',cs=s.library.filter(c=>m?c.k===s.teacher.k&&!c.mentor:!c.evolved&&c.effect!=='chain');
      const opts=cs.map(c=>button('teach',c.id,line(c.name,G.fields[c.k]+' ・ '+c.steps+'日')));
      if(m)opts.push(button('skipMentor',0,'見送る','secondary'));
      return choices(m?text(s.teacher.name)+'が帰還':'修練札の進化','book',m?'先達の直伝で修練に経験が加わり、野営と祠で奥義を学びやすくなります。':'修練札を1枚選び、永久に連携効果を刻みます。',opts);
    }
    const leavers=s.roster.filter(p=>s.year-p.year>=2);
    return choices('春の代替わり','flag',leavers.length?'3年の契約を終えた仲間が独立します。次の世代に技を託す先達を選んでください。':'仲間が最初の1年を終えました。次の春の契約書が届いています。',leavers.length?leavers.map(p=>button('succession',p.id,portrait(p)+line(text(p.name),G.roles[p.role][0])+'<b>継承</b>')):[button('succession',0,'次の春へ','primary')]);
  }
  function memberCard(p,editable){
    const current=s.party.indexOf(p.id);
    const slots=[0,1,2].map(i=>`<option value="${i}" ${i===current?'selected':''}>${i+1}枠</option>`).join('');
    const stats=G.fields.map((label,k)=>`<b>${label} ${p.stats[k]}</b>`).join('');
    const skills=p.arts.map((level,k)=>level?`${G.arts[k]} Lv.${level}（${G.artNotes[k]}）`:'').filter(Boolean);
    const limit=G.cap(s,p);
    const leading=p.id===s.focus;
    return `<article class="member">
      ${portrait(p)}
      <div class="bio">
        <div class="between"><b>${text(p.name)}</b>${rank(p)}</div>
        <p>${G.roles[p.role][0]} ・ ${s.year-p.year+1}年目</p>
        <small>${G.roles[p.role][1]} ／ 能力上限 ${Number.isFinite(limit)?limit:'なし'}</small>
        <div class="mini-stats">${stats}</div>
        ${skills.length?'<small>'+skills.join(' ／ ')+'</small>':''}
        <div class="assign">
          ${button('focus',p.id,leading?'✓ 重点育成':'重点にする','pill',leading)}
          <label>出撃枠
            <select data-party="${p.id}" ${editable?'':'disabled'} aria-label="${text(p.name)}の出撃枠">
              <option value="-1" disabled ${current<0?'selected':''}>控え</option>${slots}
            </select>
          </label>
        </div>
      </div>
    </article>`;
  }
  function team(){
    if(!s.roster.length)return choices('冒険者名鑑','people','契約を結ぶと、ここで出撃する仲間を選べます。',[button('tab',0,'契約式へ','primary')]);
    const editable=!s.expedition||s.phase==='prepare';
    return `<div class="sheet">
      ${heading('people','冒険者名鑑',s.roster.length+'人')}
      <p class="hint">出撃は3人。同系統が2人以上ならその戦技の威力 +2、3系統がそろうと開始時の星力 +1。</p>
      <div class="members">${s.roster.map(p=>memberCard(p,editable)).join('')}</div>
      ${button('tab',0,'旅路に戻る','secondary')}
    </div>`;
  }
  function hall(){
    return '<div class="sheet">'+heading('hall','ギルドの拠点','功績 '+s.stars)+'<p class="hint">遠征と契約満了で得た功績を、次の世代にも残る施設に投資します。</p><div class="choices">'+G.workshops.map(([v,d],i)=>button('upgrade',i,line(v+'　Lv.'+s.facility[i],d)+'<b>'+G.cost(s,i)+' 功績</b>','choice',s.stars<G.cost(s,i))).join('')+'</div><div class="depth">'+heading('flag','遠征の深度','灯冠 '+s.crowns)+'<p class="hint">夏か春の遠征を踏破すると、ひとつ深い層が開きます。</p><div class="between">'+button('depth',s.depth-1,'−','secondary',!!s.expedition||s.depth<=0)+'<b>深度 '+(s.depth+1)+'</b>'+button('depth',s.depth+1,'＋','secondary',!!s.expedition||s.depth>s.cleared)+'</div></div></div>';
  }
  function journal(){return '<div class="sheet">'+heading('book','旅団の年代記')+(s.logs.length?'<ol class="journal">'+s.logs.map(l=>'<li><small>'+l.year+'年目 ・ '+Y.date(l.day)+'</small><b>'+text(l.title)+'</b><p>'+text(l.detail)+'</p></li>').join('')+'</ol>':'<p class="hint">契約を結ぶと、ここに旅の記録が残ります。</p>')+'</div>';}
  function sidebar(){
    const intro=s.phase==='intake',e=s.expedition;
    if(e)return '<aside><section class="sheet">'+heading('people','出撃隊')+memberList()+(s.phase==='prepare'?button('tab',1,'編成する','link'):'')+'</section><section class="sheet">'+heading('star','遠征の装備')+'<p class="hint">星灯のランタン ・ 最大体力 +'+2*(s.lantern||0)+'</p>'+(e.boost||[]).map((v,i)=>v?'<p>'+acts[i]+'の威力 +'+v+'</p>':'').join('')+'</section></aside>';
    const kind=s.day<Y.events.summer?'summer':s.day<Y.events.autumn?'autumn':s.qualified&&s.day<Y.events.spring?'spring':'summer';
    const foe=e?e.foe??0:kind==='summer'?0:kind==='autumn'?1:2;
    return '<aside><section class="sheet destination">'+heading('compass','遠征案内')+'<div class="destination-img"><img src="'+art+'foe-'+foe+'.webp" alt="'+G.enemies[foe][0]+'"></div><div class="dest-copy"><small>'+(!e?(s.day>=Y.events[kind]?'翌年':'')+Y.date(Y.events[kind])+' 遠征':phaseTitles[s.phase])+'</small><h3>'+G.expeditions[e?e.kind:kind]+'</h3><p>'+['木立を抜けた先で、苔むす石巨人が古道を守る。','霧の精霊が待つ星門。突破すれば春の星塔へ進める。','夜明けの星塔で、星喰いの竜が目を覚ます。'][foe]+'</p></div></section>'+(s.roster.length?'<section class="sheet">'+heading('people','出撃隊')+memberList()+button('tab',1,'編成する','link')+'</section>':intro?'<section class="sheet mini-guide">'+heading('book','旅の心得')+'<p>修練札で仲間を育て、遠征には3人を送り出します。3年の契約を終えた冒険者は、新人に奥義を託します。</p></section>':'')+'</aside>';
  }
  const tabs=['旅路','冒険者','拠点','年代記'],icons=['compass','people','hall','book'];
  function render(){
    $('#nav').innerHTML=tabs.map((v,i)=>'<button data-act="tab" data-n="'+i+'" aria-current="'+(i===tab?'page':'false')+'">'+ico(icons[i])+'<span>'+v+'</span></button>').join('');
    $('#main').innerHTML=hero()+'<div class="layout"><section class="board">'+[mainBoard,team,hall,journal][tab]()+'</section>'+sidebar()+'</div>';
    if(s.notice&&!settings)modalNotice();
  }
  function show(body){$('#modal-body').innerHTML=body;if(!$('#modal').open)$('#modal').showModal();}
  function modalNotice(){const n=s.notice;show('<div class="notice '+(n.rare?'rare':'')+'">'+ico(n.rare?'star':'moon')+'<h2 id="dialog-title">'+text(n.title)+'</h2><p>'+text(n.detail)+'</p>'+button('ack',0,'旅を続ける','primary')+'</div>');}
  function options(){
    settings=true;show('<h2 id="dialog-title">設定と遊び方</h2><p>修練札の日数だけ街道を進みます。野営で奥義を学び、遠征では敵の予兆を読んで戦技を選びましょう。</p><p>記録はこのブラウザに自動保存されます。</p><div class="choices">'+button('sound',0,'効果音 ・ '+(sound?'オン':'オフ'),'secondary')+[1,2].map(n=>button('slot',n,'旅団の記録 '+n+(n===slot?' ・ 使用中':''),'secondary',n===slot)).join('')+'</div><a href="./baseball.html">旧作「ダイヤモンドループ」の記録を開く</a>'+button('close',0,'閉じる','primary'));
  }
  $('#brand').onclick=()=>{tab=0;render();window.scrollTo(0,0);};
  $('#settings').innerHTML=ico('gear');$('#settings').onclick=options;
  $('#modal').addEventListener('cancel',evt=>{if(s.notice&&!settings){evt.preventDefault();return;}settings=false;});
  document.addEventListener('click',evt=>{
    const b=evt.target.closest('[data-act]');if(!b||b.disabled)return;
    const a=b.dataset.act,n=Number(b.dataset.n);
    if(a==='tab'){tab=n;render();window.scrollTo(0,0);return;}
    if(a==='sound'){sound=!sound;try{localStorage.setItem(base+'.sound',sound?'on':'off');}catch{}chime(false);options();return;}
    if(a==='close'){$('#modal').close();settings=false;render();return;}
    if(a==='slot'){try{const next=read(n);slot=n;s=next;saveError=false;tab=0;settings=false;$('#modal').close();save();render();}catch{toast('この記録を読み込めません。');}return;}
    if(s.notice&&a!=='ack')return;
    const commands={reveal:()=>G.reveal(s,!!n),accept:G.accept,train:G.train,auto:G.auto,camp:G.camp,teach:G.teach,visit:G.visit,oath:G.chooseOath,succession:G.succession,
      focus:G.focus,lock:G.lock,toggle:G.toggle,upgrade:G.upgrade,depth:G.depth,launch:G.launch,strike:G.strike,advance:G.advance,ack:G.acknowledge,skipMentor:G.skipMentor};
    const before=s.phase;
    if(!commands[a]?.(s,n))return;
    if(a==='ack')$('#modal').close();
    if(before!==s.phase){clearTimeout(timer);$('#toast').classList.remove('on');}
    if(a==='reveal'||a==='advance'||s.notice?.rare)chime(!!s.notice?.rare||(a==='reveal'&&s.pack.slice(n?0:s.drawn-1,s.drawn).some(p=>p.rank>=3))||(a==='advance'&&before==='result'));
    save();render();
    if(before!==s.phase&&a!=='ack')document.querySelector('.board').scrollIntoView({block:'start'});
    if(['train','auto','visit'].includes(a)&&s.phase==='practice'&&!s.notice)toast(s.last);
    if(a==='upgrade')toast('施設を拡張しました。');
  });
  document.addEventListener('change',evt=>{const sel=evt.target.closest('[data-party]');if(sel&&G.setParty(s,Number(sel.dataset.party),Number(sel.value))){save();render();toast('出撃隊を変更しました。');}});
  function preview(evt){const d=evt.target.closest('.drill[data-day]')?.dataset.day;document.querySelectorAll('.tile').forEach(t=>t.classList.toggle('target',t.dataset.day===d));}
  document.addEventListener('pointerover',preview);document.addEventListener('focusin',preview);
  save();render();
})();
