(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a,b) => a + Math.random() * (b-a);
  const query = new URLSearchParams(location.search);
  const lang = query.get('lang') === 'id' ? 'id' : 'en';
  const startCount = name => {
    const value = Number(query.get(name));
    return Number.isInteger(value) && value >= 1 && value <= 42 ? value : 42;
  };
  const initialCards = [startCount('p1start'), startCount('p2start')];
  const T = lang === 'id' ? {
    small:'Kecil',medium:'Sedang',large:'Besar',cards:'KARTU',discard:'BUANGAN',wrong:'SALAH GEBRAK',
    gameName:'GEBRAKAN',instruction:'GEBRAK KARTU SAAT COCOK',
    slap:p=>'GEBRAK! '+p+' TERCEPAT', wins:p=>p+' MENANG', restart:'ULANGI'
  } : {
    small:'Small',medium:'Medium',large:'Large',cards:'CARDS',discard:'DISCARD',wrong:'WRONG SLAP',
    gameName:'SLAP',instruction:'SLAP THE CARD WHEN IT MATCHES THE CALL!',
    slap:p=>'SLAP! '+p+' IS FASTEST', wins:p=>p+' WINS THE GAME', restart:'RESTART'
  };
  document.documentElement.lang=lang;
  $('#game-name').textContent=T.gameName; $('#game-instruction').textContent=T.instruction;
  $('#label-cards-1').textContent=$('#label-cards-2').textContent=T.cards;
  $('#label-discard').textContent=T.discard; $('#restart').textContent=T.restart;

  const specs = [
    ['grape','anggur','fruit','round','purple','small'],['orange','jeruk','fruit','round','orange','medium'],['watermelon','semangka','fruit','round','green','large'],
    ['golf ball','bola golf','sports','round','white','small'],['tennis ball','bola tenis','sports','round','green','medium'],['basket ball','bola basket','sports','round','orange','large'],
    ['house roof','atap rumah','building','triangle','red','large'],['tent','tenda','building','triangle','yellow','large'],['pyramid','piramid','building','triangle','brown','large'],
    ['cake slice','sepotong kue','food','triangle','orange','small'],['pizza slice','sepotong pizza','food','triangle','yellow','medium'],['jelly','jeli','food','round','purple','small'],
    ['handphone','ponsel','gadget','rectangle','black','small'],['tv','tv','gadget','rectangle','black','medium'],['laptop','laptop','gadget','rectangle','red','medium'],
    ['swimming trunk','celana renang','fashion','triangle','blue','small'],['cloth hanger','gantungan baju','fashion','triangle','blue','large'],['hat','topi','fashion','round','purple','medium'],
    ['table','meja','furniture','rectangle','brown','medium'],['cupboard','lemari','furniture','rectangle','brown','large'],['bed','ranjang','furniture','rectangle','white','large'],
    ['paper airplane','pesawat kertas','toy','triangle','yellow','small'],['dice','dadu','toy','rectangle','red','small'],['alphabet block','balok huruf','toy','rectangle','green','small'],
    ['the triangle','trikona','music','triangle','white','medium'],['drum','drum','music','round','blue','medium'],['piano','piano','music','rectangle','black','large']
  ];
  let running=false, generation=0, players, discard, turn, callIndex, pendingWinner;
  const makeDeck = () => {
    const d=[]; specs.forEach(s => { for(let qty=1;qty<=3;qty++) d.push({qty,name:s[0],local:s[1],size:s[5],file:`${qty}-${s[0]}.png`}); });
    ['wildcard max 1','wildcard tux 1','wildcard+cut lyx 1'].forEach(name=>d.push({wild:true,name,local:name,size:null,file:name+'.png'}));
    for(let i=d.length-1;i;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];} return d;
  };
  function cardEl(card, back=false){
    const e=document.createElement('div'); e.className='card '+(back?'back':'front');
    if(!back) e.style.backgroundImage=`url("images/cards-front/${encodeURIComponent(card.file).replace(/%2F/g,'/')}")`;
    return e;
  }
  function update(){
    $('#count-p1').textContent=players[0].length; $('#count-p2').textContent=players[1].length; $('#discard-count').textContent=discard.length;
    $('#pile-p1 .card').style.visibility=players[0].length?'visible':'hidden'; $('#pile-p2 .card').style.visibility=players[1].length?'visible':'hidden';
  }
  async function flipCard(card,g){
    const face=cardEl(card,true), angle=rand(-3,3); $('#discard').replaceChildren(face);
    const hide=face.animate([
      {transform:`rotate(${angle}deg) rotateY(0deg)`},
      {transform:`rotate(${angle}deg) rotateY(90deg)`}
    ],{duration:150,easing:'ease-in',fill:'forwards'});
    await hide.finished; if(g!==generation){face.remove();return;}
    hide.cancel();
    face.className='card front';
    face.style.backgroundImage=`url("images/cards-front/${encodeURIComponent(card.file).replace(/%2F/g,'/')}")`;
    const reveal=face.animate([
      {transform:`rotate(${angle}deg) rotateY(90deg)`},
      {transform:`rotate(${angle}deg) rotateY(0deg)`}
    ],{duration:150,easing:'ease-out',fill:'forwards'});
    await reveal.finished; if(g!==generation){face.remove();return;}
    face.style.transform=`rotate(${angle}deg)`; reveal.cancel();
  }
  function showBanner(text, cls='', duration=1100){ const b=$('#banner'); b.textContent=text;b.className='show '+cls; return sleep(duration).then(()=>b.className=''); }
  async function flyCard(player,card,g){
    const stage=$('#stage').getBoundingClientRect(), src=$(`#pile-p${player+1}`).getBoundingClientRect(), dst=$('#discard').getBoundingClientRect();
    const e=cardEl(card,true);e.classList.add('flying');e.style.left=(src.left-stage.left)+'px';e.style.top=(src.top-stage.top)+'px';$('#stage').append(e);
    const flight=e.animate([
      {transform:'translate(0,0) rotate(0deg) scale(1)',offset:0},
      {transform:`translate(${(dst.left-src.left)*.55}px,${(dst.top-src.top)*.55-30}px) rotate(${rand(-5,5)}deg) scale(1.06)`,offset:.55},
      {transform:`translate(${dst.left-src.left}px,${dst.top-src.top}px) rotate(${rand(-8,8)}deg) scale(1)`,offset:1}
    ],{duration:600,easing:'cubic-bezier(.2,.75,.28,1)',fill:'forwards'});
    await flight.finished; if(g!==generation){e.remove();return;}
    e.remove(); await flipCard(card,g);
  }
  async function slap(player,g){
    const hand=$(`#hand-p${player+1}`), t=rand(.1,.2); hand.style.setProperty('--slap-time',t+'s'); hand.className=`hand p${player+1}-hand slap-p${player+1}`; await sleep(t*1000+80); if(g!==generation)return; hand.className=`hand p${player+1}-hand`;
  }
  async function collect(player,g){
    const top=$('#discard .card');
    if(top){
      const stage=$('#stage').getBoundingClientRect(), pile=$(`#pile-p${player+1}`), dst=pile.getBoundingClientRect(), r=top.getBoundingClientRect();
      pile.classList.add('pile-moving');
      const moveAside=pile.animate([
        {transform:'translate(-50%,-50%) translateX(0)'},
        {transform:'translate(-50%,-50%) translateX(145px)'}
      ],{duration:450,easing:'cubic-bezier(.3,.75,.3,1)',fill:'forwards'});
      await moveAside.finished;
      if(g!==generation){pile.classList.remove('pile-moving');return;}

      const stack=document.createElement('div'); stack.className='collection-stack face-down-only'; stack.style.left=(r.left-stage.left)+'px'; stack.style.top=(r.top-stage.top)+'px';
      stack.append(cardEl(discard[discard.length-1],true)); $('#stage').append(stack); top.style.visibility='hidden';
      const dx=dst.left-r.left, dy=dst.top-r.top;
      const move=stack.animate([
        {transform:'translate(0,0) rotate(0deg) scale(1)',offset:0},
        {transform:`translate(${dx*.52}px,${dy*.48-38}px) rotate(${player===0?-7:7}deg) scale(1.035)`,offset:.52},
        {transform:`translate(${dx}px,${dy}px) rotate(0deg) scale(.98)`,offset:1}
      ],{duration:1550,easing:'cubic-bezier(.22,.72,.24,1)',fill:'forwards'});
      await move.finished;

      const returnPile=pile.animate([
        {transform:'translate(-50%,-50%) translateX(145px)'},
        {transform:'translate(-50%,-50%) translateX(0)'}
      ],{duration:700,easing:'cubic-bezier(.22,.8,.28,1)',fill:'forwards'});
      await returnPile.finished;
      moveAside.cancel(); returnPile.cancel(); pile.classList.remove('pile-moving'); stack.remove();
    }
    if(g!==generation)return; players[player].push(...discard); discard=[]; $('#discard').replaceChildren(); update(); await sleep(250);
  }
  async function handleSlap(match,active,g){
    let collector;
    if(!match){ const mistakenSlapper=Math.random()<.5?0:1; await slap(mistakenSlapper,g); $('#discard .card')?.classList.add('highlight'); await showBanner(T.wrong,'',1250); collector=mistakenSlapper; }
    else { const winner=Math.random()<.5?0:1; collector=1-winner; const order=winner===0?[1,0]:[0,1]; slap(order[0],g); await sleep(rand(35,85)); await slap(order[1],g); $('#discard .card')?.classList.add('highlight'); await showBanner(T.slap('P'+(winner+1)),'',1200); }
    await collect(collector,g); turn=collector; return collector;
  }
  async function game(g){
    await sleep(2000);
    while(g===generation && running){
      if(!players[turn].length){ turn=1-turn; if(!players[turn].length) break; }
      const active=turn, card=players[active].shift(), ci=callIndex; callIndex=(callIndex+1)%9;
      if(players[active].length===0 && pendingWinner===null) pendingWinner=active;
      update();
      await flyCard(active,card,g); discard.push(card); update(); if(g!==generation)return;
      const qty=ci%3+1, size=['small','medium','large'][Math.floor(ci/3)]; const c=$('#call');c.textContent=`${qty} ${T[size]}`;c.classList.add('show');
      await sleep(rand(500,2000)); const match=card.wild||(card.qty===qty&&card.size===size);
      if(match || Math.random()<.02){
        const loser=await handleSlap(match,active,g);
        if(pendingWinner!==null){
          if(loser!==pendingWinner && players[pendingWinner].length===0){ await finish(pendingWinner,g);return; }
          if(loser===pendingWinner) pendingWinner=null;
        }
      }
      c.classList.remove('show'); turn=1-active; await sleep(260);
    }
  }
  async function finish(player,g){ if(g!==generation)return; running=false; $('#call').classList.remove('show'); const b=$('#banner');b.textContent=T.wins('P'+(player+1));b.className='show winner'; }
  function start(){
    generation++; running=true; const deck=makeDeck(); players=[deck.splice(0,initialCards[0]),deck.splice(0,initialCards[1])]; discard=[];turn=0;callIndex=0;pendingWinner=null;
    $('#discard').replaceChildren();$('#banner').className='';$('#call').className='';update();game(generation);
  }
  $('#restart').addEventListener('click',start); start();
})();
