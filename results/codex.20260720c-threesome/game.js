(() => {
  'use strict';

  const OBJECTS = [
    'grape','orange','watermelon','golf ball','tennis ball','basket ball',
    'house roof','tent','pyramid','cake slice','pizza slice','jelly',
    'handphone','tv','laptop','swimming trunk','cloth hanger','hat',
    'table','cupboard','bed','paper airplane','dice','alphabet block',
    'the triangle','drum','piano'
  ];
  const lang = new URLSearchParams(location.search).get('lang') === 'id' ? 'id' : 'en';
  const words = lang === 'id'
    ? { discard: 'BUANGAN', prepare: 'Mencari trio', draw: 'mengambil kartu', wins: 'MENANG', instruction: 'BUANG TRIO KARTU DI TANGANMU, HINDARI MENJADI PEMAIN DENGAN 2 KARTU TERAKHIR' }
    : { discard: 'DISCARD', prepare: 'Finding trios', draw: 'draws a card', wins: 'WINS', instruction: 'DISCARD TRIOS OF CARDS IN YOUR HAND, AVOID ENDING UP WITH THE LAST 2 CARDS' };
  document.documentElement.lang = lang;
  document.getElementById('discard-label').textContent = words.discard;
  document.getElementById('instruction').textContent = words.instruction;

  const players = [
    { hand: [], handEl: byId('p1-hand'), label: byId('p1-label') },
    { hand: [], handEl: byId('p2-hand'), label: byId('p2-label') }
  ];
  const discardEl = byId('discard-pile');
  const discardCount = byId('discard-count');
  const status = byId('status');
  const layer = byId('animation-layer');
  const discarded = [];

  function byId(id) { return document.getElementById(id); }
  function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  function shuffle(a) {
    for (let i = a.length - 1; i; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function family(card) { return card.slice(2); }
  function src(card) { return `images/cards-front/${encodeURIComponent(card)}.png`; }
  function makeCard(card) {
    const img = document.createElement('img');
    img.className = 'card'; img.src = src(card); img.alt = card; img.dataset.card = card;
    return img;
  }
  function layout(player) {
    const hand = player.hand, el = player.handEl;
    el.replaceChildren();
    const step = hand.length > 1 ? Math.min(100, (el.clientWidth - 100) / (hand.length - 1)) : 0;
    hand.forEach((card, i) => {
      const img = makeCard(card); img.style.left = `${i * step}px`; img.style.zIndex = i + 1; el.append(img);
    });
    player.label.querySelector('.count').textContent = hand.length;
  }
  function renderDiscard() {
    discardEl.replaceChildren();
    if (discarded.length) discardEl.append(makeCard(discarded.at(-1)));
    discardCount.textContent = discarded.length;
  }
  function findTrio(hand) {
    const groups = new Map();
    hand.forEach(c => { const f = family(c); if (!groups.has(f)) groups.set(f, []); groups.get(f).push(c); });
    return [...groups.values()].find(g => g.length === 3) || null;
  }
  function cardRect(player, card) {
    const imgs = [...player.handEl.children];
    const i = player.hand.indexOf(card);
    return (imgs[i] || imgs.find(el => el.dataset.card === card)).getBoundingClientRect();
  }
  function floating(card, rect) {
    const board = byId('game').getBoundingClientRect();
    const img = makeCard(card); img.classList.add('flying');
    img.style.left = `${rect.left - board.left}px`; img.style.top = `${rect.top - board.top}px`;
    layer.append(img); return img;
  }
  async function discardTrio(player, trio) {
    const rects = trio.map(c => cardRect(player, c));
    const clones = trio.map((c, i) => floating(c, rects[i]));
    const board = byId('game').getBoundingClientRect();
    const spreadLeft = board.left + 360 - 50 - 112;
    clones.forEach((img, i) => {
      const dx = spreadLeft + i * 112 - rects[i].left;
      const zone = player === players[0] ? 1 : -1;
      img.style.transform = `translate(${dx}px, ${zone * 40}px) scale(1.08)`;
      img.classList.add('highlight');
    });
    await wait(500);
    trio.forEach(c => player.hand.splice(player.hand.indexOf(c), 1));
    layout(player);
    const target = discardEl.getBoundingClientRect();
    clones.forEach((img, i) => {
      const r = rects[i];
      img.classList.remove('highlight');
      img.style.transform = `translate(${target.left - r.left}px, ${target.top - r.top}px) scale(1)`;
    });
    await wait(500);
    clones.forEach(img => img.remove());
    discarded.push(...trio); renderDiscard();
  }
  async function initialDiscards() {
    status.textContent = words.prepare;
    for (const p of players) {
      let trio;
      while ((trio = findTrio(p.hand))) await discardTrio(p, trio);
    }
  }
  async function draw(turn) {
    const player = players[turn], other = players[1 - turn];
    player.label.classList.add('active');
    status.textContent = `P${turn + 1} ${words.draw}`;
    const index = Math.floor(Math.random() * other.hand.length);
    const card = other.hand[index];
    const from = cardRect(other, card);
    const clone = floating(card, from);
    clone.classList.add('highlight'); clone.style.transform = `translateY(${turn === 0 ? -36 : 36}px) scale(1.08)`;
    await wait(500);
    other.hand.splice(index, 1); layout(other);
    player.hand.push(card); layout(player);
    const destination = cardRect(player, card);
    const landedCard = [...player.handEl.children].find(el => el.dataset.card === card);
    landedCard.style.visibility = 'hidden';
    clone.classList.remove('highlight');
    clone.style.transform = `translate(${destination.left - from.left}px, ${destination.top - from.top}px)`;
    await wait(500);
    clone.remove();
    landedCard.style.visibility = '';
    await wait(500);
    const trio = findTrio(player.hand);
    if (trio) await discardTrio(player, trio);
    player.label.classList.remove('active');
  }
  async function play() {
    await wait(2000);
    await initialDiscards();
    await wait(2000);
    let turn = 0;
    while (players[0].hand.length + players[1].hand.length > 2) {
      if (!players[1 - turn].hand.length) break;
      await draw(turn); await wait(1000); turn = 1 - turn;
    }
    const winner = players[0].hand.length === 0 ? 1 : 2;
    status.textContent = '';
    const result = byId('result'); result.textContent = `P${winner} ${words.wins}`; result.classList.add('show');
  }

  const deck = [];
  OBJECTS.forEach(name => [1,2,3].forEach(n => { if (!(n === 3 && name === 'pizza slice')) deck.push(`${n}-${name}`); }));
  shuffle(deck);
  players[0].hand = deck.slice(0, 40); players[1].hand = deck.slice(40);
  layout(players[0]); layout(players[1]); renderDiscard();
  window.addEventListener('resize', () => players.forEach(layout));
  play();
})();
