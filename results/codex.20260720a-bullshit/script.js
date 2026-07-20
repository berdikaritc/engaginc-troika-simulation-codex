(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const random = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
  const lang = new URLSearchParams(location.search).get('lang') === 'id' ? 'id' : 'en';
  document.documentElement.lang = lang;
  $('game-title').textContent = lang === 'id' ? 'BOONG-BOONGAN' : 'BULLSHIT';

  const words = {
    en: { hand:'HAND', play:'PLAY AREA', true:'TRUE', lie:'BULLSHIT', correct:'CORRECT GUESS', wrong:'INCORRECT GUESS', wins:'WINS',
      all:'All cards are', atLeast:'At least one card is', no:'There are no cards that are', one:'There is at least one', wild:'There is at least one wildcard.', noWild:'There are no wildcards.' },
    id: { hand:'KARTU', play:'AREA MAIN', true:'BENAR', lie:'BOONG', correct:'TEBAKAN BENAR', wrong:'TEBAKAN SALAH', wins:'MENANG',
      all:'Semua kartu beratribut', atLeast:'Setidaknya satu kartu beratribut', no:'Tidak ada kartu beratribut', one:'Setidaknya ada satu', wild:'Setidaknya ada satu wildcard.', noWild:'Tidak ada wildcard.' }
  }[lang];
  $('p1-label').textContent = `P1 ${words.hand}`; $('p2-label').textContent = `P2 ${words.hand}`; $('play-label').textContent = words.play;

  const defs = [
    ['grape','anggur','fruit','buah','round','bundar','purple','ungu','small','kecil'], ['orange','jeruk','fruit','buah','round','bundar','orange','oranye','medium','sedang'], ['watermelon','semangka','fruit','buah','round','bundar','green','hijau','large','besar'],
    ['golf ball','bola golf','sports','olahraga','round','bundar','white','putih','small','kecil'], ['tennis ball','bola tenis','sports','olahraga','round','bundar','green','hijau','medium','sedang'], ['basket ball','bola basket','sports','olahraga','round','bundar','orange','oranye','large','besar'],
    ['house roof','atap rumah','building','bangunan','triangle','segitiga','red','merah','large','besar'], ['tent','tenda','building','bangunan','triangle','segitiga','yellow','kuning','large','besar'], ['pyramid','piramid','building','bangunan','triangle','segitiga','brown','cokelat','large','besar'],
    ['cake slice','sepotong kue','food','makanan','triangle','segitiga','orange','oranye','small','kecil'], ['pizza slice','sepotong pizza','food','makanan','triangle','segitiga','yellow','kuning','medium','sedang'], ['jelly','jeli','food','makanan','round','bundar','purple','ungu','small','kecil'],
    ['handphone','ponsel','gadget','gawai','rectangle','kotak','black','hitam','small','kecil'], ['tv','tv','gadget','gawai','rectangle','kotak','black','hitam','medium','sedang'], ['laptop','laptop','gadget','gawai','rectangle','kotak','red','merah','medium','sedang'],
    ['swimming trunk','celana renang','fashion','fesyen','triangle','segitiga','blue','biru','small','kecil'], ['cloth hanger','gantungan baju','fashion','fesyen','triangle','segitiga','blue','biru','large','besar'], ['hat','topi','fashion','fesyen','round','bundar','purple','ungu','medium','sedang'],
    ['table','meja','furniture','mebel','rectangle','kotak','brown','cokelat','medium','sedang'], ['cupboard','lemari','furniture','mebel','rectangle','kotak','brown','cokelat','large','besar'], ['bed','ranjang','furniture','mebel','rectangle','kotak','white','putih','large','besar'],
    ['paper airplane','pesawat kertas','toy','mainan','triangle','segitiga','yellow','kuning','small','kecil'], ['dice','dadu','toy','mainan','rectangle','kotak','red','merah','small','kecil'], ['alphabet block','balok huruf','toy','mainan','rectangle','kotak','green','hijau','small','kecil'],
    ['the triangle','trikona','music','musik','triangle','segitiga','white','putih','medium','sedang'], ['drum','drum','music','musik','round','bundar','blue','biru','medium','sedang'], ['piano','piano','music','musik','rectangle','kotak','black','hitam','large','besar']
  ];
  let uid=0;
  const deck = defs.flatMap(d => [1,2,3].map(q => ({ id:uid++, file:`${q}-${d[0]}`, name:d[lang==='id'?1:0], category:d[lang==='id'?3:2], shape:d[lang==='id'?5:4], color:d[lang==='id'?7:6], size:d[lang==='id'?9:8], wild:false })))
    .concat(['wildcard max 1','wildcard tux 1','wildcard+cut lyx 1'].map(file => ({id:uid++,file,name:'wildcard',wild:true})));
  shuffle(deck);
  const players = [
    {hand:deck.splice(0,7), el:$('p1-hand'), msg:$('p1-message')},
    {hand:deck.splice(0,7), el:$('p2-hand'), msg:$('p2-message')}
  ];

  function makeCard(card) {
    const el=document.createElement('div'); el.className='card'; el.dataset.id=card.id; el.dataset.face='up';
    const img=document.createElement('img'); img.src=`images/cards-front/${encodeURIComponent(card.file)}.png`; img.alt=card.file; el.append(img); card.el=el; return el;
  }
  function layoutHand(p) {
    p.hand.forEach((c,i) => { if (c.el.parentElement!==p.el) p.el.append(c.el); c.el.style.left=`${i*27}px`; c.el.style.zIndex=i+1; c.el.style.top='0px'; });
  }
  players.forEach(p => { p.hand.forEach(c => p.el.append(makeCard(c))); layoutHand(p); });

  async function flip(cards, down) {
    await Promise.all(cards.map(async c => {
      await c.el.animate([{transform:'scaleX(1)'},{transform:'scaleX(0)'}],{duration:250,easing:'ease-in',fill:'forwards'}).finished;
      c.el.querySelector('img').src = down ? 'images/cards-back/back.png' : `images/cards-front/${encodeURIComponent(c.file)}.png`;
      c.el.dataset.face=down?'down':'up';
      await c.el.animate([{transform:'scaleX(0)'},{transform:'scaleX(1)'}],{duration:250,easing:'ease-out',fill:'forwards'}).finished;
      c.el.getAnimations().forEach(a=>a.cancel());
    }));
  }
  async function stagePicked(cards, actorIndex) {
    const stage=$('stage'), overlay=$('card-overlay'), zone=$(`p${actorIndex+1}-zone`);
    const stageRect=stage.getBoundingClientRect(), zoneRect=zone.getBoundingClientRect();
    const starts=cards.map(c=>c.el.getBoundingClientRect());
    const gap=5, total=cards.length*165+(cards.length-1)*gap;
    cards.forEach((c,i)=>{
      overlay.append(c.el); c.el.classList.add('selected','hovering');
      c.el.style.left=`${zoneRect.left-stageRect.left+Math.max(8,(495-total)/2)+i*(165+gap)}px`;
      c.el.style.top=`${zoneRect.top-stageRect.top+(actorIndex===0?55:30)}px`;
      c.el.style.zIndex=`${900+i}`;
    });
    const ends=cards.map(c=>c.el.getBoundingClientRect());
    await Promise.all(cards.map((c,i)=>c.el.animate([
      {transform:`translate(${starts[i].left-ends[i].left}px,${starts[i].top-ends[i].top}px) scale(1)`},
      {transform:'translate(0,-12px) scale(1.035)',offset:.72},
      {transform:'translate(0,-8px) scale(1.025)'}
    ],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}).finished));
  }
  async function moveCards(cards, destination, destinationHand=null) {
    const stage=$('stage'), overlay=$('card-overlay'), stageRect=stage.getBoundingClientRect();
    const starts=cards.map(c=>c.el.getBoundingClientRect());
    let ends;
    if (destinationHand) {
      cards.forEach(c=>destinationHand.hand.push(c));
      layoutHand(destinationHand);
      ends=cards.map(c=>c.el.getBoundingClientRect());
    }
    else {
      cards.forEach((c,i)=>{
        destination.append(c.el);
        c.el.style.left=`${(720-(cards.length*165+(cards.length-1)*10))/2+i*175}px`;
        c.el.style.top='8px'; c.el.style.zIndex=i+1;
      });
      ends=cards.map(c=>c.el.getBoundingClientRect());
    }

    // Fly on the stage itself so no hand or zone can clip or cover the cards.
    cards.forEach((c,i)=>{
      overlay.append(c.el);
      c.el.style.left=`${ends[i].left-stageRect.left}px`;
      c.el.style.top=`${ends[i].top-stageRect.top}px`;
      c.el.style.zIndex=`${900+i}`;
    });
    await Promise.all(cards.map((c,i)=>c.el.animate([
      {transform:`translate(${starts[i].left-ends[i].left}px,${starts[i].top-ends[i].top}px)`},{transform:'translate(0,0)'}
    ],{duration:700,easing:'cubic-bezier(.22,.72,.2,1)',fill:'both'}).finished));
    if (destinationHand) layoutHand(destinationHand);
    else cards.forEach((c,i)=>{
      destination.append(c.el);
      c.el.style.left=`${(720-(cards.length*165+(cards.length-1)*10))/2+i*175}px`;
      c.el.style.top='8px'; c.el.style.zIndex=i+1;
    });
    cards.forEach(c=>c.el.getAnimations().forEach(a=>a.cancel()));
  }

  const unique=(arr,key)=>[...new Map(arr.filter(Boolean).map(x=>[x[key],x])).values()];
  function claimsFor(cards) {
    const attrs=['color','shape','size','category']; const pool=[];
    attrs.forEach(attr => unique(deck.concat(players[0].hand,players[1].hand,cards).filter(c=>!c.wild),attr).forEach(sample => {
      const value=sample[attr]; const label=value;
      pool.push({truth:cards.every(c=>c.wild||c[attr]===value), text:`${words.all} ${label}.`});
      pool.push({truth:cards.some(c=>c.wild||c[attr]===value), text:`${words.atLeast} ${label}.`});
      pool.push({truth:cards.every(c=>!c.wild&&c[attr]!==value), text:`${words.no} ${label}.`});
    }));
    unique(defs.map(d=>({name:d[lang==='id'?1:0]})),'name').forEach(o=>pool.push({truth:cards.some(c=>c.wild||c.name===o.name),text:`${words.one} ${o.name}.`}));
    pool.push({truth:cards.some(c=>c.wild),text:words.wild},{truth:cards.every(c=>!c.wild),text:words.noWild});
    return pool;
  }
  async function turn(actorIndex) {
    const actor=players[actorIndex], guesser=players[1-actorIndex];
    actor.msg.textContent=''; guesser.msg.textContent='';
    const count=Math.min(3,actor.hand.length);
    const picked=shuffle([...actor.hand]).slice(0,count);
    const desiredTruth=Math.random()<.5, eligible=claimsFor(picked).filter(c=>c.truth===desiredTruth), claim=random(eligible);
    actor.msg.textContent=claim.text;
    await stagePicked(picked,actorIndex);
    await wait(3000);
    picked.forEach(c=>{ c.el.classList.remove('selected','hovering'); c.el.getAnimations().forEach(a=>a.cancel()); c.el.style.zIndex='90'; });
    await flip(picked,true);
    actor.hand=actor.hand.filter(c=>!picked.includes(c)); layoutHand(actor);
    await moveCards(picked,$('play-area'));
    await wait(2000+Math.random()*1000);
    const guessCorrect=Math.random()<.5; const guessedTrue=guessCorrect?claim.truth:!claim.truth;
    guesser.msg.textContent=guessedTrue?words.true:words.lie;
    await wait(2000); await flip(picked,false);
    actor.msg.textContent=guesser.msg.textContent=guessCorrect?words.correct:words.wrong;
    await wait(500);
    const receiver=guessCorrect?actor:guesser;
    await moveCards(picked,receiver.el,receiver);
    await wait(1000+Math.random()*1000);
    return actor.hand.length===0 ? actorIndex : -1;
  }
  async function game() {
    await wait(2000); let active=0;
    while (true) { const won=await turn(active); if(won>=0) { const box=$('winner'); box.textContent=`P${won+1} ${words.wins}`; box.classList.add('show'); break; } active=1-active; }
  }
  game();
})();
