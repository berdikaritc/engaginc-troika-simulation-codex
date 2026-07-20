(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const lang = new URLSearchParams(location.search).get("lang") === "id" ? "id" : "en";
  document.documentElement.lang = lang;

  const words = {
    en: { instruction:"CALL MATCHING ASPECT OF 3 CARDS THE FASTEST. COLLECT ALL THE CARDS", discard:"DISCARD", wins:"WINS", wild:"WILD", quantity:["ONE","TWO","THREE"] },
    id: { instruction:"SEBUTKAN ASPEK 3 KARTU TERCEPAT, KUMPULKAN SEMUA KARTU.", discard:"BUANGAN", wins:"MENANG", wild:"BEBAS", quantity:["SATU","DUA","TIGA"] }
  }[lang];
  $("#instruction").textContent = words.instruction;
  $("#discard-label-text").textContent = words.discard;

  const translations = {
    fruit:"buah", sports:"olahraga", building:"bangunan", food:"makanan", gadget:"gawai", fashion:"fesyen", furniture:"mebel", toy:"mainan", music:"musik",
    round:"bundar", triangle:"segitiga", rectangle:"kotak", small:"kecil", medium:"sedang", large:"besar",
    white:"putih", black:"hitam", red:"merah", blue:"biru", green:"hijau", yellow:"kuning", orange:"oranye", purple:"ungu", brown:"cokelat"
  };
  const specs = [
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
  let deck = specs.flatMap(([object,category,shape,color,size]) => [1,2,3].map(quantity => ({
    name:`${quantity}-${object}`, object, category, shape, color, size, quantity:String(quantity), wild:false
  })));
  for (const family of ["wildcard max", "wildcard tux", "wildcard+cut lyx"])
    for (let n=1; n<=6; n++) deck.push({ name:`${family} ${n}`, wild:true });

  // Fisher-Yates gives a fresh game on every load.
  for (let i=deck.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]]; }
  const params=new URLSearchParams(location.search);
  function startingCount(name, fallback, available) {
    const raw=params.get(name);
    if (raw===null || !/^\d+$/.test(raw)) return Math.min(fallback,available);
    return Math.min(Number(raw),available);
  }
  const p1Start=startingCount("p1start",50,deck.length);
  const p2Start=startingCount("p2start",49,deck.length-p1Start);
  const players = [deck.slice(0,p1Start),deck.slice(p1Start,p1Start+p2Start)];
  let center = [], batchNumber = 0;
  const pileEls = [$("#p1-pile"), $("#p2-pile")];
  const labelEls = [$("#p1-label"), $("#p2-label")];
  const messageEls = [$("#p1-message"), $("#p2-message")];

  function updateCounts() {
    $("#p1-count").textContent=players[0].length; $("#p2-count").textContent=players[1].length;
    $("#discard-count").textContent=center.length;
    pileEls.forEach((el,i) => el.style.visibility=players[i].length ? "visible" : "hidden");
  }
  function imgPath(card) { return `images/cards-front/${encodeURIComponent(card.name).replace(/%2F/gi,"/")}.png`; }
  function makeCard(card, faceDown=true) {
    const el=document.createElement("div"); el.className="card";
    const img=document.createElement("img"); img.src=faceDown ? "images/cards-back/back.png" : imgPath(card); img.alt=card.name;
    el.append(img); el.dataset.name=card.name; return el;
  }
  function rect(el) { const r=el.getBoundingClientRect(), g=$("#game").getBoundingClientRect(), scale=g.width/720; return {x:(r.left-g.left)/scale,y:(r.top-g.top)/scale}; }
  async function dealThree(p) {
    const cards=players[p].splice(0,3); center.push(...cards); updateCounts(); batchNumber++;
    // Keep the accumulated discard at the same coordinates, strictly below
    // the new three in z-order. It shows through as the new cards flip.
    const history=$("#discard-history"), current=$("#discard-current");
    [...current.querySelectorAll(".card")].forEach(el => {
      el.classList.remove("current-batch");
      el.classList.add("previous-batch");
      el.style.top="33px";
      history.append(el);
    });
    const from=rect(pileEls[p]);
    const targets=[{x:118,y:465},{x:216,y:465},{x:314,y:465}];
    const els=cards.map((card,i) => {
      const el=makeCard(card,true); el.classList.add("current-batch"); el.style.left=`${from.x+i*5}px`; el.style.top=`${from.y-i*5}px`; el.style.zIndex=String(100+i); $("#game").append(el); return el;
    });
    await Promise.all(els.map((el,i)=>el.animate([
      {transform:"translate(0,0) rotate(0deg)"},
      {transform:`translate(${targets[i].x-(from.x+i*5)}px,${targets[i].y-(from.y-i*5)}px) rotate(${(i-1)*2}deg)`}
    ],{duration:500,easing:"cubic-bezier(.22,.8,.28,1)",fill:"forwards"}).finished));
    els.forEach((el,i)=>{
      el.getAnimations().forEach(a=>a.cancel());
      el.style.left=`${targets[i].x}px`;
      el.style.top="33px";
      current.append(el);
    });
    await Promise.all(els.map(async (el,i)=>{
      const close=el.animate([{transform:"scaleX(1)"},{transform:"scaleX(0)"}],{duration:250,easing:"ease-in",fill:"forwards"});
      await close.finished;
      close.cancel();
      el.style.transform="scaleX(0)";
      el.querySelector("img").src=imgPath(cards[i]);
      const open=el.animate([{transform:"scaleX(0)"},{transform:"scaleX(1)"}],{duration:250,easing:"ease-out",fill:"forwards"});
      await open.finished;
      open.cancel();
      el.style.transform="";
    }));
    return cards;
  }
  function matchingAspect(cards) {
    const normal=cards.filter(c=>!c.wild);
    if (!normal.length) return words.wild;
    const keys=["object","category","size","shape","quantity","color"];
    const matches=keys.filter(k=>normal.every(c=>c[k]===normal[0][k]));
    if (!matches.length) return null;
    const k=matches[Math.floor(Math.random()*matches.length)], value=normal[0][k];
    if (k==="quantity") return words.quantity[Number(value)-1];
    return (lang==="id" ? translations[value] : value).toUpperCase();
  }
  async function collect(caller) {
    const visible=[...$("#discard").querySelectorAll(".card")];
    await Promise.all(visible.map(el=>el.animate([{transform:"translateX(0)"},{transform:`translateX(${216-parseFloat(el.style.left)}px)`}],{duration:500,easing:"ease-in-out",fill:"forwards"}).finished));
    visible.forEach(el=>{ el.getAnimations().forEach(a=>a.cancel()); el.style.left="216px"; });
    await Promise.all(visible.map(async el=>{
      const close=el.animate([{transform:"scaleX(1)"},{transform:"scaleX(0)"}],{duration:250,fill:"forwards"});
      await close.finished;
      close.cancel();
      el.style.transform="scaleX(0)";
      el.querySelector("img").src="images/cards-back/back.png";
      const open=el.animate([{transform:"scaleX(0)"},{transform:"scaleX(1)"}],{duration:250,fill:"forwards"});
      await open.finished;
      open.cancel();
      el.style.transform="";
    }));
    const target=rect(pileEls[caller]);
    const slide=pileEls[caller].animate([{transform:"translateX(0)"},{transform:"translateX(190px)"}],{duration:450,easing:"ease-in-out",fill:"forwards"});
    await Promise.all(visible.map((el,i)=>{
      const position=rect(el);
      return el.animate([{transform:"translate(0,0)"},{transform:`translate(${target.x-position.x}px,${target.y-position.y}px)`}],{duration:500,delay:i*3,easing:"cubic-bezier(.3,.05,.25,1)",fill:"forwards"}).finished;
    }));
    players[caller].push(...center); center=[]; updateCounts();
    await slide.finished;
    pileEls[caller].style.zIndex="500";
    await pileEls[caller].animate([{transform:"translateX(190px)"},{transform:"translateX(0)"}],{duration:280,easing:"ease-out",fill:"forwards"}).finished;
    visible.forEach(el=>el.remove());
    pileEls[caller].getAnimations().forEach(a=>a.cancel());
    pileEls[caller].style.zIndex="";
  }
  async function turn(p) {
    messageEls.forEach(el=>{el.classList.remove("calling"); el.textContent="";});
    labelEls[p].classList.add("active");
    if (players[p].length<3) { center.push(...players[p].splice(0)); updateCounts(); return false; }
    const cards=await dealThree(p);
    await wait(200+Math.random()*800);
    const match=matchingAspect(cards);
    if (match) {
      const caller=Math.random()<.5?0:1;
      messageEls[caller].textContent=match; messageEls[caller].classList.add("calling");
      await wait(1000); await collect(caller);
    }
    labelEls[p].classList.remove("active");
    await wait(260); return true;
  }
  async function run() {
    updateCounts(); await wait(2000);
    let p=0;
    while (await turn(p)) p=1-p;
    labelEls.forEach(el=>el.classList.remove("active"));
    const winner=1-p; if (center.length) { players[winner].push(...center); center=[]; updateCounts(); }
    await wait(500); const panel=$("#winner"); panel.textContent=`P${winner+1} ${words.wins}`; panel.classList.add("show");
  }
  run();
})();
