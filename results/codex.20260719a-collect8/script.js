(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const lang = new URLSearchParams(location.search).get('lang') === 'id' ? 'id' : 'en';
  document.documentElement.lang = lang;
  const copy = {
    en:{hand:'HAND',drawPile:'DRAW PILE',discardPile:'DISCARD PILE',turn:p=>`${p}'S TURN`,thinking:'THINKING…',wins:p=>`${p} WINS`,draw:'DRAW'},
    id:{hand:'KARTU',drawPile:'TUMPUKAN AMBIL',discardPile:'TUMPUKAN BUANG',turn:p=>`GILIRAN ${p}`,thinking:'BERPIKIR…',wins:p=>`${p} MENANG`,draw:'SERI'}
  }[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => el.textContent = copy[el.dataset.i18n]);

  const items = [
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
  const all = items.flatMap(([name,category,color]) => [1,2,3].map(q => ({name:`${q}-${name}`,category,color})));
  const byName = n => all.find(c => c.name === n);
  const red = ['1-house roof','2-house roof','3-house roof','1-laptop','2-laptop','3-laptop','1-dice','2-dice','3-dice'].map(byName);
  const used = new Set();
  const take = n => { const c=byName(n); used.add(n); return c; };
  // A legal preset deal creates an intelligible short story: P1 commits to red.
  const hands = {
    P1:[take('1-house roof'),take('2-house roof'),take('3-house roof'),take('1-laptop'),take('2-laptop'),take('1-grape'),take('1-orange'),take('1-table'),take('1-drum')],
    P2:[take('1-watermelon'),take('2-watermelon'),take('3-watermelon'),take('1-tennis ball'),take('2-tennis ball'),take('1-jelly'),take('1-hat'),take('1-piano'),take('1-cupboard')]
  };
  const scripted = [take('3-laptop'),take('2-jelly'),take('1-dice'),take('2-hat'),take('2-dice')];
  const rest = all.filter(c => !used.has(c.name)).sort(() => Math.random()-.5);
  const deck = [...scripted, ...rest];
  const discard = [];

  const cardImg = (card, back=false) => {
    const img=document.createElement('img'); img.className='card';
    img.src=back?'images/cards-back/back.png':`images/cards-front/${card.name}.png`;
    img.alt=back?'Face-down card':card.name; return img;
  };
  function renderHand(p) {
    const el=$(`#${p.toLowerCase()}-hand`); el.replaceChildren();
    hands[p].forEach((c,i)=>{const img=cardImg(c); img.style.setProperty('--i',i); el.append(img);});
  }
  function renderPiles() {
    $('#draw-count').textContent=deck.length;
    const d=$('#discard-pile'); d.replaceChildren();
    if(discard.length){const img=cardImg(discard.at(-1)); img.style.position='relative'; d.append(img);}
  }
  function point(el, x=.5, y=.5) { const r=el.getBoundingClientRect(), s=$('#stage').getBoundingClientRect(); return {x:r.left-s.left+r.width*x,y:r.top-s.top+r.height*y}; }
  async function fly(card, fromEl, toEl, duration, targetIndex=0) {
    const a=point(fromEl), b=point(toEl,0,0); const f=cardImg(card); f.className='flying-card';
    f.style.left=`${a.x-82.5}px`; f.style.top=`${a.y-128}px`; $('#stage').append(f);
    if(fromEl.classList.contains('card')) fromEl.style.visibility='hidden';
    const targetX = toEl.classList.contains('hand') ? b.x + targetIndex*47 : b.x;
    const targetY = toEl.classList.contains('hand') ? b.y : b.y;
    const dx=targetX-(a.x-82.5), dy=targetY-(a.y-128);
    const anim=f.animate([{transform:'translate(0,0) rotate(-4deg) scale(.94)'},{offset:.48,transform:`translate(${dx*.5}px,${dy*.5-34}px) rotate(4deg) scale(1.08)`},{transform:`translate(${dx}px,${dy}px) rotate(0) scale(1)`}],{duration,easing:'cubic-bezier(.35,.05,.18,1)',fill:'forwards'});
    await anim.finished; f.remove();
  }
  async function deal() {
    const p1=[...hands.P1], p2=[...hands.P2]; hands.P1=[]; hands.P2=[];
    for(let i=0;i<9;i++) for(const p of ['P1','P2']) {
      const c=(p==='P1'?p1:p2)[i];
      await fly(c,$('#draw-pile'),$(`#${p.toLowerCase()}-hand`),400,i);
      hands[p].push(c); renderHand(p);
    }
  }
  const score = (p,key) => Math.max(...Object.values(hands[p].reduce((a,c)=>(a[c[key]]=(a[c[key]]||0)+1,a),{})));
  const chooseDiscard = p => {
    if(p==='P1') return hands[p].findIndex(c=>c.color!=='red');
    const counts=hands[p].reduce((a,c)=>(a[c.category]=(a[c.category]||0)+1,a),{});
    const target=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
    return hands[p].findIndex(c=>c.category!==target);
  };
  async function turn(p) {
    $(`#${p.toLowerCase()}-label`).classList.add('active'); $('#turn-status').textContent=copy.turn(p);
    if(!deck.length) return 'draw';
    const c=deck.shift(); renderPiles(); await fly(c,$('#draw-pile'),$(`#${p.toLowerCase()}-hand`),1000,hands[p].length); hands[p].push(c); renderHand(p);
    if(score(p,'color')>=8 || score(p,'category')>=8) return p;
    $('#turn-status').textContent=copy.thinking; await sleep(1400);
    const idx=chooseDiscard(p), out=hands[p][idx], source=$(`#${p.toLowerCase()}-hand .card:nth-child(${idx+1})`);
    await fly(out,source,$('#discard-pile'),1000); hands[p].splice(idx,1); discard.push(out); renderHand(p); renderPiles();
    $(`#${p.toLowerCase()}-label`).classList.remove('active'); $('#turn-status').textContent=''; await sleep(1000); return null;
  }
  async function start() {
    // Recorder-safe warm-up: decode artwork before any timed movement begins.
    await Promise.all(all.map(c => new Promise(resolve => {
      const img=new Image(); img.onload=img.onerror=resolve; img.src=`images/cards-front/${c.name}.png`;
    })));
    await Promise.all(['images/cards-back/back.png','images/hands/hands-01.png','images/hands/hands-02.png'].map(src => new Promise(resolve => {
      const img=new Image(); img.onload=img.onerror=resolve; img.src=src;
    })));
    renderPiles(); await sleep(2000); await deal(); await sleep(900);
    let result=null, p='P1';
    while(!result){result=await turn(p); p=p==='P1'?'P2':'P1';}
    $('#turn-status').textContent=''; document.querySelectorAll('.player-label').forEach(x=>x.classList.remove('active'));
    $('#result div').textContent=result==='draw'?copy.draw:copy.wins(result); $('#result').classList.add('show');
  }
  start();
})();
