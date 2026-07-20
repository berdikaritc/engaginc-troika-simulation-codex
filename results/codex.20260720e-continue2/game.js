(() => {
  "use strict";

  const LANG = new URLSearchParams(location.search).get("lang") === "id" ? "id" : "en";
  const TEXT = {
    en: { title: "CONTINUE TWO", reminder: "MATCH AT LEAST TWO ASPECTS OF PREVIOUS CARD", draw: "DRAW PILE", discard: "DISCARD", cards: "cards", pass: "PASS", wins: "WINS", tie: "DRAW", turn: "'s TURN" },
    id: { title: "SAMBUNG DUA", reminder: "COCOKKAN MINIMAL 2 ASPEK DENGAN KARTU SEBELUMNYA", draw: "TUMPUKAN AMBIL", discard: "BUANGAN", cards: "kartu", pass: "LEWAT", wins: "MENANG", tie: "SERI", turn: " BERMAIN" }
  }[LANG];

  const translations = {
    grape:"anggur", orange:"jeruk", watermelon:"semangka", "golf ball":"bola golf", "tennis ball":"bola tenis", "basket ball":"bola basket",
    "house roof":"atap rumah", tent:"tenda", pyramid:"piramid", "cake slice":"sepotong kue", "pizza slice":"sepotong pizza", jelly:"jeli",
    handphone:"ponsel", tv:"tv", laptop:"laptop", "swimming trunk":"celana renang", "cloth hanger":"gantungan baju", hat:"topi",
    table:"meja", cupboard:"lemari", bed:"ranjang", "paper airplane":"pesawat kertas", dice:"dadu", "alphabet block":"balok huruf",
    "the triangle":"trikona", drum:"drum", piano:"piano"
  };
  const attrID = { fruit:"buah", sports:"olahraga", building:"bangunan", food:"makanan", gadget:"gawai", fashion:"fesyen", furniture:"mebel", toy:"mainan", music:"musik", round:"bundar", triangle:"segitiga", rectangle:"kotak", white:"putih", black:"hitam", red:"merah", blue:"biru", green:"hijau", yellow:"kuning", orange:"oranye", purple:"ungu", brown:"cokelat", small:"kecil", medium:"sedang", large:"besar" };
  const objects = [
    ["grape","fruit","round","purple","small"],["orange","fruit","round","orange","medium"],["watermelon","fruit","round","green","large"],
    ["golf ball","sports","round","white","small"],["tennis ball","sports","round","green","medium"],["basket ball","sports","round","orange","large"],
    ["house roof","building","triangle","red","large"],["tent","building","triangle","yellow","large"],["pyramid","building","triangle","brown","large"],
    ["cake slice","food","triangle","orange","small"],["pizza slice","food","triangle","yellow","medium"],["jelly","food","round","purple","small"],
    ["handphone","gadget","rectangle","black","small"],["tv","gadget","rectangle","black","medium"],["laptop","gadget","rectangle","red","medium"],
    ["swimming trunk","fashion","triangle","blue","small"],["cloth hanger","fashion","triangle","blue","large"],["hat","fashion","round","purple","medium"],
    ["table","furniture","rectangle","brown","medium"],["cupboard","furniture","rectangle","brown","large"],["bed","furniture","rectangle","white","large"],
    ["paper airplane","toy","triangle","yellow","small"],["dice","toy","rectangle","red","small"],["alphabet block","toy","rectangle","green","small"],
    ["the triangle","music","triangle","white","medium"],["drum","music","round","blue","medium"],["piano","music","rectangle","black","large"]
  ];
  let uid = 0;
  const deck = objects.flatMap(([object,category,shape,color,size]) => [1,2,3].map(quantity => ({ id: ++uid, quantity, object, category, shape, color, size, wild:false })));
  ["wildcard max 1","wildcard tux 1","wildcard+cut lyx 1"].forEach(name => deck.push({ id:++uid, name, wild:true }));

  const $ = id => document.getElementById(id);
  const els = { hands:[$("p1-hand"),$("p2-hand")], labels:[$("p1-label"),$("p2-label")], draw:$("draw-pile"), discard:$("discard-pile"), count:$("draw-count"), call:$("callout"), status:$("status"), result:$("result") };
  const state = { draw:shuffle([...deck]), hands:[[],[]], discard:[], lastNormal:null, ended:false, consecutivePasses:0 };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function shuffle(a) { for(let i=a.length-1;i;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function assetName(card) { if(card.wild) return card.name; const object = LANG === "id" ? translations[card.object] : card.object; return `${card.quantity}-${object}`; }
  function front(card) { return `images/cards-front/${card.wild ? card.name : `${card.quantity}-${card.object}`}.png`; }
  function matches(a,b) { return a.wild || ["object","category","quantity","size","color","shape"].filter(k => a[k]===b[k]); }
  function callFor(card) { const shared=matches(card,state.lastNormal); if(card.wild) return card.name.toUpperCase(); return shared.slice(0,2).map(k => String(LANG==="id" ? (attrID[card[k]]||card[k]) : card[k]).toUpperCase()).join(" • "); }

  function cardEl(card, faceUp=true) {
    const img=document.createElement("img");
    img.className="card"+(faceUp?"":" back"); img.dataset.id=card.id;
    img.alt=faceUp?assetName(card):"Card back"; img.src=faceUp?front(card):"images/cards-back/back.png";
    img.onerror=()=>{ const box=document.createElement("div"); box.className=img.className+" placeholder"; box.dataset.id=card.id; box.style.cssText=img.style.cssText; box.textContent=faceUp?assetName(card).toUpperCase():"CONTINUE TWO"; img.replaceWith(box); };
    return img;
  }
  function renderHand(p, exclude=-1) {
    const hand=els.hands[p], cards=state.hands[p]; hand.innerHTML="";
    const usable=hand.clientWidth-120, gap=cards.length>1?Math.min(92,usable/(cards.length-1)):0;
    cards.forEach((c,i)=>{ if(c.id===exclude)return; const el=cardEl(c); el.style.left=`${i*gap}px`; el.style.zIndex=i+1; hand.append(el); });
  }
  function renderDraw(exclude=false) { els.draw.innerHTML=""; if(state.draw.length&&!exclude) els.draw.append(cardEl(state.draw.at(-1),false)); els.count.textContent=`${state.draw.length} ${TEXT.cards}`; }
  function renderDiscard(exclude=-1) {
    els.discard.innerHTML=""; const normals=state.discard.filter(c=>!c.wild); const lastN=normals.at(-1); const wilds=[];
    for(let i=state.discard.length-1;i>=0&&state.discard[i].wild;i--) wilds.unshift(state.discard[i]);
    [lastN,...wilds].filter(c=>c&&c.id!==exclude).forEach((c,i)=>{ const el=cardEl(c); el.style.top=`${i*15}px`; el.style.left=i===0?"0px":`${20+(i-1)*4}px`; el.style.zIndex=i+1; els.discard.append(el); });
  }
  function rect(el) { const r=el.getBoundingClientRect(); return {left:r.left,top:r.top}; }
  async function fly(card, start, to, face=true) {
    const end=rect(to), ghost=cardEl(card,face);
    ghost.classList.add("flying");
    ghost.style.left=`${start.left}px`;
    ghost.style.top=`${start.top}px`;
    document.body.append(ghost);
    const movement=ghost.animate([
      { transform:"translate3d(0, 0, 0)" },
      { transform:`translate3d(${end.left-start.left}px, ${end.top-start.top}px, 0)` }
    ], { duration:500, easing:"cubic-bezier(.4, 0, .2, 1)", fill:"forwards" });
    await movement.finished;
    return ghost;
  }
  async function discard(p,index) {
    const card=state.hands[p][index], source=els.hands[p].querySelector(`[data-id="${card.id}"]`); source.classList.add("selected");
    els.call.textContent=callFor(card); els.call.classList.add("show"); await sleep(500);
    const start=rect(source);
    state.hands[p].splice(index,1); renderHand(p,card.id); const ghost=await fly(card,start,els.discard,true);
    state.discard.push(card); if(!card.wild) state.lastNormal=card; renderDiscard(); renderHand(p); ghost.remove(); state.consecutivePasses=0; await sleep(500); els.call.classList.remove("show");
  }
  async function drawOne(p) {
    const card=state.draw.pop(), source=els.draw.querySelector(".card"), start=rect(source); renderDraw();
    const finalCount=state.hands[p].length+1;
    const gap=finalCount>1 ? Math.min(92,(els.hands[p].clientWidth-120)/(finalCount-1)) : 0;
    const target=document.createElement("div"); target.style.cssText=`position:absolute;width:120px;height:187px;left:${(finalCount-1)*gap}px;top:0`; els.hands[p].append(target);
    const ghost=await fly(card,start,target,false); state.hands[p].push(card); renderHand(p);
    const el=els.hands[p].querySelector(`[data-id="${card.id}"]`);
    el.style.visibility="hidden";
    const flipper=document.createElement("div");
    flipper.className="flip-card";
    flipper.style.left=el.style.left;
    flipper.style.top=el.style.top||"0px";
    const backFace=document.createElement("img"), frontFace=document.createElement("img");
    backFace.className="flip-face back"; backFace.src="images/cards-back/back.png";
    frontFace.className="flip-face front"; frontFace.src=front(card);
    flipper.append(backFace,frontFace); els.hands[p].append(flipper);
    await Promise.all([backFace.decode().catch(()=>{}),frontFace.decode().catch(()=>{})]);
    ghost.remove();
    const flipAnimation=flipper.animate([
      { transform:"perspective(700px) rotateY(0deg)" },
      { transform:"perspective(700px) rotateY(180deg)" }
    ], { duration:500, easing:"ease-in-out", fill:"forwards" });
    await flipAnimation.finished;
    flipper.remove(); renderHand(p); renderDraw(); return card;
  }
  async function turn(p) {
    els.labels[p].classList.add("active"); els.status.textContent=`P${p+1}${TEXT.turn}`; await sleep(260);
    let idx=state.hands[p].findIndex(c=>c.wild || matches(c,state.lastNormal).length>=2);
    while(idx<0 && state.draw.length) { const drawn=await drawOne(p); idx=(drawn.wild||matches(drawn,state.lastNormal).length>=2)?state.hands[p].length-1:-1; }
    if(idx>=0) await discard(p,idx); else { els.call.textContent=TEXT.pass; els.call.classList.add("show"); state.consecutivePasses++; await sleep(850); els.call.classList.remove("show"); }
    els.labels[p].classList.remove("active"); els.status.textContent="";
    if(!state.hands[p].length) {
      finish(`P${p+1} ${TEXT.wins}`);
    } else if(state.consecutivePasses>=2) {
      const p1Cards=state.hands[0].length, p2Cards=state.hands[1].length;
      if(p1Cards===p2Cards) finish(TEXT.tie);
      else finish(`P${p1Cards<p2Cards?1:2} ${TEXT.wins}`);
    }
  }
  function finish(message) { state.ended=true; els.result.textContent=message; els.result.classList.add("show"); }
  async function start() {
    $("game-title").textContent=TEXT.title; $("rule-reminder").textContent=TEXT.reminder; $("draw-label").textContent=TEXT.draw; $("discard-label").textContent=TEXT.discard;
    for(let n=0;n<6;n++){ state.hands[0].push(state.draw.pop()); state.hands[1].push(state.draw.pop()); }
    let starter=state.draw.findLastIndex(c=>!c.wild); const [first]=state.draw.splice(starter,1); state.discard.push(first); state.lastNormal=first;
    renderHand(0); renderHand(1); renderDraw(); renderDiscard(); await sleep(2000);
    let p=0; while(!state.ended){ await turn(p); if(!state.ended){ await sleep(1000); p=1-p; } }
  }
  start();
})();
