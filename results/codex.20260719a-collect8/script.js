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
  const hands = {P1:[], P2:[]};
  const goals = {P1:null, P2:null};
  // Fisher–Yates gives every refresh a new, unbiased ordering of all 81 cards.
  const deck = [...all];
  for(let i=deck.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }
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
    for(let i=0;i<9;i++) for(const p of ['P1','P2']) {
      const c=deck.shift(); renderPiles();
      await fly(c,$('#draw-pile'),$(`#${p.toLowerCase()}-hand`),400,i);
      hands[p].push(c); renderHand(p);
    }
  }
  const score = (p,key) => Math.max(...Object.values(hands[p].reduce((a,c)=>(a[c[key]]=(a[c[key]]||0)+1,a),{})));
  const chooseGoal = p => {
    const candidates=[];
    for(const key of ['color','category']) {
      const counts=hands[p].reduce((a,c)=>(a[c[key]]=(a[c[key]]||0)+1,a),{});
      for(const [value,count] of Object.entries(counts)) candidates.push({key,value,count});
    }
    return candidates.sort((a,b)=>b.count-a.count || Math.random()-.5)[0];
  };
  const chooseDiscard = (p,target) => {
    const choices=hands[p].map((c,i)=>({c,i})).filter(({c})=>c[target.key]!==target.value);
    return choices.length ? choices[Math.floor(Math.random()*choices.length)].i : Math.floor(Math.random()*hands[p].length);
  };
  async function turn(p) {
    $(`#${p.toLowerCase()}-label`).classList.add('active'); $('#turn-status').textContent=copy.turn(p);
    const target=goals[p];
    const topDiscard=discard.at(-1);
    const takeDiscard=topDiscard && topDiscard[target.key]===target.value;
    if(!takeDiscard && !deck.length) return 'draw';
    const source=takeDiscard ? $('#discard-pile .card') : $('#draw-pile');
    const c=takeDiscard ? topDiscard : deck.shift();
    await fly(c,source,$(`#${p.toLowerCase()}-hand`),1000,hands[p].length);
    if(takeDiscard) discard.pop();
    hands[p].push(c); renderHand(p); renderPiles();
    if(score(p,'color')>=8 || score(p,'category')>=8) return p;
    $('#turn-status').textContent=copy.thinking; await sleep(1400);
    const idx=chooseDiscard(p,target), out=hands[p][idx], sourceCard=$(`#${p.toLowerCase()}-hand .card:nth-child(${idx+1})`);
    await fly(out,sourceCard,$('#discard-pile'),1000); hands[p].splice(idx,1); discard.push(out); renderHand(p); renderPiles();
    $(`#${p.toLowerCase()}-label`).classList.remove('active'); $('#turn-status').textContent=''; await sleep(1000); return null;
  }
  async function start() {
    // Recorder-safe warm-up: decode artwork before any timed movement begins.
    await Promise.all(all.map(c => new Promise(resolve => {
      const img=new Image(); img.onload=img.onerror=resolve; img.src=`images/cards-front/${c.name}.png`;
    })));
    await Promise.all(['images/cards-back/back.png'].map(src => new Promise(resolve => {
      const img=new Image(); img.onload=img.onerror=resolve; img.src=src;
    })));
    renderPiles(); await sleep(2000); await deal();
    goals.P1=chooseGoal('P1'); goals.P2=chooseGoal('P2');
    await sleep(900);
    let result=null, p='P1';
    while(!result){result=await turn(p); p=p==='P1'?'P2':'P1';}
    $('#turn-status').textContent=''; document.querySelectorAll('.player-label').forEach(x=>x.classList.remove('active'));
    $('#result div').textContent=result==='draw'?copy.draw:copy.wins(result); $('#result').classList.add('show');
  }
  start();
})();
