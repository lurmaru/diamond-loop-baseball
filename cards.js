/* Permanent school notebook and its seasonal playing deck. */
(function(){
  'use strict';
  const names=[
    ['素振り','トス打撃','ロングティー','特打','逆方向打ち','選球練習','一球勝負','実戦打席','連続安打'],
    ['投げ込み','制球練習','遠投','ブルペン','模擬登板','低めの制球','変化球研究','配球研究','継投練習'],
    ['ノック','捕球練習','中継プレー','守備連係','二遊間連係','捕殺練習','前進守備','盗塁阻止','併殺練習']
  ];
  const specialties=['打撃','投球','守備'];
  const effects=['','', '', '', 'pair','focus','chain','focus','chain'];
  const rarity=c=>['N','R','SR'][c.tier]||'N';
  // The secondary skill follows the drill itself, e.g. batting power for long tee,
  // pitch control for precision work, and arm strength for relay throws.
  const specialtiesByRow=[[3,7,8],[6,4,5],[3,7,8],[3,4,5],[6,4,5],[6,4,8],[3,4,5],[6,4,8],[6,7,8]];
  const specialty=c=>specialtiesByRow[Math.floor(c.id/3)][c.k];
  function make(id){
    const k=id%3, row=Math.floor(id/3);
    return {id,k,name:names[k][row],steps:1+(row+k)%3,tier:row<3?0:row<7?1:2,effect:effects[row],evolved:false,mentor:null};
  }
  function detail(c){
    const lines=[];
    if(c.effect==='pair')lines.push(['一塁手の打撃に練習点 +2','捕手の守備に練習点 +2','遊撃手の守備に練習点 +2'][c.k]);
    if(c.effect==='focus')lines.push('重点選手に練習点 +2');
    if(c.effect==='chain'||c.evolved)lines.push(specialties[(c.k+2)%3]+'の次なら練習点 +2');
    if(c.mentor)lines.push(c.mentor+'直伝・練習点 +1、特能率上昇');
    return lines.join(' ／ ');
  }
  function createCatalog(make,detail){
    const card=(s,id)=>s.library.find(c=>c.id===id);
    const minimum=s=>Math.max(12,s.handSize+1);
    function shuffle(list,random){
      const result=list.slice();
      for(let i=result.length-1;i>0;i--){
        const j=Math.floor(random()*(i+1));
        [result[i],result[j]]=[result[j],result[i]];
      }
      return result;
    }
    function init(s,oldHand=[]){
      s.library=Array.from({length:15},(_,id)=>make(id));
      s.deck=s.library.slice(0,12).map(c=>c.id);s.handSize=4;s.lastKind=-1;
      s.pile=[];s.discard=[];s.cards=[];
      for(const [i,old] of oldHand.slice(0,4).entries()){
        Object.assign(s.library[i],{k:old.k,name:old.name,tier:old.tier,steps:old.steps||i+1});
        s.cards.push(s.library[i]);
      }
    }
    function refill(s,random){
      while(s.cards.length<s.handSize){
        if(!s.pile.length){s.pile=shuffle(s.discard,random);s.discard=[];}
        if(!s.pile.length)break;
        s.cards.push(card(s,s.pile.pop()));
      }
    }
    function reset(s,random){
      s.cards=[];s.discard=[];s.lastKind=-1;
      s.pile=shuffle(s.deck,random);refill(s,random);
    }
    function spend(s,index,random){
      // Exhaust the existing stock before recycling the just-played card.
      const [used]=s.cards.splice(index,1);
      refill(s,random);s.discard.push(used.id);refill(s,random);
      const replacement=s.cards.pop();
      s.cards.splice(index,0,replacement);
      s.lastKind=used.k;
    }
    function begin(s,window){
      s.phase='build';s.buildWindow=window;s.draft=s.deck.slice();
    }
    function toggle(s,id){
      if(s.phase!=='build'||!card(s,id))return false;
      const i=s.draft.indexOf(id);
      if(i<0)s.draft.push(id);else s.draft.splice(i,1);
      return true;
    }
    function lock(s,random){
      if(s.phase!=='build'||s.report||s.draft.length<minimum(s))return false;
      s.deck=s.draft.slice();s.draft=[];reset(s,random);s.phase='practice';return true;
    }
    function offers(s,random,guaranteed=false){
      const missing=Array.from({length:27},(_,i)=>i).filter(id=>!card(s,id));
      const regular=shuffle(missing.filter(id=>make(id).tier<2),random);
      const rare=missing.filter(id=>make(id).tier===2);
      if(rare.length && ((!regular.length&&guaranteed)||random()<(regular.length ? .18 : .32))){
        return shuffle([...regular.slice(0,2),rare[Math.floor(random()*rare.length)]],random);
      }
      return regular.slice(0,3);
    }
    function acquire(s,id){
      if(!Number.isInteger(id)||id<0||id>=27||card(s,id))return false;
      s.library.push(make(id));return true;
    }
    const slotPrice=s=>24+18*(s.handSize-4)**2;
    return {rarity,make,card,minimum,shuffle,init,refill,reset,spend,begin,toggle,lock,offers,acquire,detail,slotPrice};
  }
  const api={...createCatalog(make,detail),specialty,createCatalog};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else globalThis.ClubCards=api;
})();
