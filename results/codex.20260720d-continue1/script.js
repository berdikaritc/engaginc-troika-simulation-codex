(() => {
  'use strict';
  const lang = new URLSearchParams(location.search).get('lang') === 'id' ? 'id' : 'en';
  const T = lang === 'id' ? {
    title:'SAMBUNG SATU', subtitle:'PERMAINAN KARTU', cards:'KARTU', draw:'TUMPUKAN AMBIL', discard:'TUMPUKAN BUANG', left:'TERSISA', pass:'LEWAT', wins:'MENANG', tie:'SERI'
  } : {
    title:'CONTINUE ONE', subtitle:'CARD GAME', cards:'CARDS', draw:'DRAW PILE', discard:'DISCARD PILE', left:'LEFT', pass:'PASS', wins:'WINS', tie:'DRAW'
  };
  const info = [
    ['grape','fruit','purple'],['orange','fruit','orange'],['watermelon','fruit','green'],
    ['golf ball','sports','white'],['tennis ball','sports','green'],['basket ball','sports','orange'],
    ['house roof','building','red'],['tent','building','yellow'],['pyramid','building','brown'],
    ['cake slice','food','orange'],['pizza slice','food','yellow'],['jelly','food','purple'],
    ['handphone','gadget','black'],['tv','gadget','black'],['laptop','gadget','red'],
    ['swimming trunk','fashion','blue'],['cloth hanger','fashion','blue'],['hat','fashion','purple'],
    ['table','furniture','brown'],['cupboard','furniture','brown'],['bed','furniture','white'],
    ['paper airplane','toy','yellow'],['dice','toy','red'],['alphabet block','toy','green'],
    ['the triangle','music','white'],['drum','music','blue'],['piano','music','black']
  ];
  const ID_CATEGORY = {fruit:'BUAH',sports:'OLAHRAGA',building:'BANGUNAN',food:'MAKANAN',gadget:'GAWAI',fashion:'FESYEN',furniture:'MEBEL',toy:'MAINAN',music:'MUSIK'};
  const ID_COLOR = {white:'PUTIH',black:'HITAM',red:'MERAH',blue:'BIRU',green:'HIJAU',yellow:'KUNING',orange:'ORANYE',purple:'UNGU',brown:'COKELAT'};
  let serial = 0;
  const cards = info.flatMap(([object,category,color]) => [1,2,3].map(q => ({id:++serial,name:`${q}-${object}`,category,color,wild:false})));
  ['wildcard max 1','wildcard tux 1','wildcard+cut lyx 1'].forEach(name => cards.push({id:++serial,name,wild:true}));
  const $ = s => document.querySelector(s), sleep = ms => new Promise(r => setTimeout(r,ms));
  const players = [[],[]], discard = []; let deck, current=0, consecutivePasses=0, ended=false;
  function shuffle(a){ for(let i=a.length-1;i;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function src(c){ return `images/cards-front/${encodeURIComponent(c.name)}.png`; }
  function img(c, cls='card'){ const el=document.createElement('img'); el.className=cls; el.src=src(c); el.alt=c.name; el.dataset.id=c.id; return el; }
  function layoutHand(p){
    const hand=$(`#hand-p${p+1}`), list=players[p]; hand.innerHTML='';
    const gap=list.length<=1?0:Math.min(102,(hand.clientWidth-120)/(list.length-1));
    list.forEach((c,i)=>{ const el=img(c); el.style.left=`${i*gap}px`; el.style.zIndex=i+1; hand.append(el); });
    $(`#p${p+1}-count`).textContent=`${list.length} ${T.cards}`;
  }
  function renderPiles(){
    const dp=$('#draw-pile'); dp.innerHTML=''; if(deck.length){ const b=document.createElement('img'); b.className='card'; b.src='images/cards-back/back.png'; b.alt=T.draw; dp.append(b); }
    $('#draw-count').textContent=`${deck.length} ${T.left}`;
    const out=$('#discard-pile'); out.innerHTML=''; const non=[...discard].reverse().find(c=>!c.wild); const top=discard.at(-1);
    if(non) out.append(img(non)); if(top?.wild){ const w=img(top,'card wild-overlay'); out.append(w); }
  }
  function rect(el){ const a=el.getBoundingClientRect(), g=$('#game').getBoundingClientRect(); return {x:a.left-g.left,y:a.top-g.top}; }
  function playable(c){ const base=[...discard].reverse().find(x=>!x.wild); return c.wild || !base || c.color===base.color || c.category===base.category; }
  function announce(text){ $('#callout').textContent=text; }
  function callFor(c){
    if(c.wild) return 'WILDCARD!'; const base=[...discard].reverse().find(x=>!x.wild);
    const value=c.color===base?.color ? c.color : c.category;
    return lang==='id' ? (ID_COLOR[value]||ID_CATEGORY[value]) : value.toUpperCase();
  }
  async function flyCard(card, fromEl, toEl, faceDown=false){
    const start=rect(fromEl), end=rect(toEl), flying=document.createElement('img');
    flying.src=faceDown?'images/cards-back/back.png':src(card); flying.className='card flying'; flying.style.left=start.x+'px'; flying.style.top=start.y+'px';
    $('#flying-layer').append(flying); fromEl.style.visibility='hidden'; flying.getBoundingClientRect();
    flying.style.transform=`translate(${end.x-start.x}px,${end.y-start.y}px) rotate(${faceDown?-4:3}deg)`; await sleep(500); flying.remove();
  }
  async function playCard(p,index){
    const c=players[p][index], el=$(`#hand-p${p+1} [data-id="${c.id}"]`); announce(callFor(c)); el.classList.add('selected'); await sleep(500);
    const target=$('#discard-pile'); players[p].splice(index,1); await flyCard(c,el,target); discard.push(c); layoutHand(p); renderPiles(); await sleep(500);
  }
  async function drawCard(p){
    const c=deck.pop(), from=$('#draw-pile .card'), hand=$(`#hand-p${p+1}`);
    // The visible top card is hidden while its flying copy animates. Put the
    // next card back underneath first so a non-empty draw pile never vanishes.
    if(deck.length){
      const underneath=document.createElement('img');
      underneath.className='card'; underneath.src='images/cards-back/back.png'; underneath.alt=T.draw;
      from.parentElement.insertBefore(underneath,from);
    }
    const placeholder=document.createElement('span'); placeholder.style.cssText=`position:absolute;left:${Math.max(0,hand.clientWidth-120)}px;top:17px;width:120px;height:186px`; hand.append(placeholder);
    await flyCard(c,from,placeholder,true); renderPiles();
    const pos=rect(placeholder), shell=document.createElement('div'); shell.className='flip-shell'; shell.style.left=pos.x+'px'; shell.style.top=pos.y+'px';
    shell.innerHTML=`<div class="flip-inner"><img class="flip-face" src="images/cards-back/back.png"><img class="flip-face flip-front" src="${src(c)}"></div>`;
    $('#flying-layer').append(shell); placeholder.remove(); shell.getBoundingClientRect(); shell.firstElementChild.classList.add('flipped'); await sleep(500);
    shell.remove(); players[p].push(c); layoutHand(p); return c;
  }
  async function takeTurn(p){
    $(`#zone-p${p+1}`).classList.add('active'); announce('');
    let idx=players[p].findIndex(playable), passed=false;
    while(idx<0 && deck.length){ await drawCard(p); await sleep(250); idx=players[p].findIndex(playable); }
    if(idx>=0){ consecutivePasses=0; await playCard(p,idx); }
    else { passed=true; consecutivePasses++; announce(T.pass); await sleep(1000); }
    $(`#zone-p${p+1}`).classList.remove('active');
    if(!players[p].length){ finish(`P${p+1} ${T.wins}`); return; }
    if(passed && consecutivePasses>=2){
      if(players[0].length===players[1].length) finish(T.tie);
      else finish(`P${players[0].length<players[1].length?1:2} ${T.wins}`);
      return;
    }
  }
  function finish(text){ ended=true; announce(''); const r=$('#result'); r.textContent=text; r.classList.add('show'); }
  async function start(){
    document.documentElement.lang=lang; $('#game-title').textContent=T.title; $('#subtitle').textContent=T.subtitle; $('#draw-label').textContent=T.draw; $('#discard-label').textContent=T.discard;
    deck=shuffle([...cards]); for(let n=0;n<6;n++){ players[0].push(deck.pop()); players[1].push(deck.pop()); }
    const firstIndex=deck.findIndex(c=>!c.wild); discard.push(deck.splice(firstIndex,1)[0]); layoutHand(0); layoutHand(1); renderPiles();
    await sleep(2000); while(!ended){ await takeTurn(current); if(ended) break; current=1-current; await sleep(1000); }
  }
  window.addEventListener('resize',()=>{ if(!ended){ layoutHand(0); layoutHand(1); } });
  start();
})();
