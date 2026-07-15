(() => {
  // Change this default for a different recording, or use index.html?sim=S2.
  const DEFAULT_SIMULATION = 'S1';
  const SIMULATION = new URLSearchParams(location.search).get('sim') || DEFAULT_SIMULATION;
  const state = { P1: [], P2: [], DISCARD: [] };
  const piles = Object.fromEntries(['P1', 'P2', 'DISCARD'].map(name => [name, document.querySelector('#' + name.toLowerCase().replace('discard', 'discard'))]));
  const $ = id => document.getElementById(id);
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const imagePath = card => `cards-front/${encodeURIComponent(card)}.png`;

  function positionFor(pile, index, total) {
    const box = piles[pile].getBoundingClientRect();
    const cardWidth = Math.min(154, Math.max(104, innerWidth * .22));
    const visibleWidth = Math.max(0, box.width - cardWidth);
    const spread = total < 2 ? 0 : Math.min(82, Math.max(25, visibleWidth / (total - 1)));
    return { left: index * spread, top: 0 };
  }
  function cardElement(card, pile, index, total) {
    const pos = positionFor(pile, index, total);
    const node = new Image();
    node.className = 'card'; node.src = imagePath(card); node.alt = card;
    node.style.left = `${pos.left}px`; node.style.top = `${pos.top}px`;
    node.dataset.card = card; return node;
  }
  function render(pile) {
    piles[pile].replaceChildren(...state[pile].map((card, index) => cardElement(card, pile, index, state[pile].length)));
  }
  function renderAll() { render('P1'); render('P2'); render('DISCARD'); }
  function setStatus(turn, step) { $('turn-label').textContent = `TURN ${turn}`; $('step-label').textContent = step; }
  function globalPoint(rect) { const root = $('game').getBoundingClientRect(); return { left: rect.left - root.left, top: rect.top - root.top, width: rect.width, height: rect.height }; }
  async function fly(card, fromRect, targetRect) {
    const from = globalPoint(fromRect), to = globalPoint(targetRect);
    const node = new Image(); node.className = 'card flying'; node.src = imagePath(card); node.alt = '';
    node.style.left = `${from.left}px`; node.style.top = `${from.top}px`; node.style.width = `${from.width}px`; node.style.height = `${from.height}px`;
    $('animation-layer').append(node);
    await new Promise(requestAnimationFrame);
    node.style.left = `${to.left}px`; node.style.top = `${to.top}px`; node.style.width = `${to.width}px`; node.style.height = `${to.height}px`;
    await sleep(1500); node.remove();
  }
  function targetRect(pile, index, total) {
    const box = piles[pile].getBoundingClientRect(), root = $('game').getBoundingClientRect(), p = positionFor(pile, index, total);
    const width = Math.min(154, Math.max(104, innerWidth * .22));
    return { left: root.left + box.left - root.left + p.left, top: root.top + box.top - root.top + p.top, width, height: width * 1029 / 662 };
  }
  async function draw(card, destination) {
    const drawRect = $('draw-pile').getBoundingClientRect();
    const target = targetRect(destination, state[destination].length, state[destination].length + 1);
    await fly(card, drawRect, target); state[destination].push(card); render(destination);
  }
  async function discardGroup(moves) {
    const source = moves[0][1];
    const cards = moves.map(move => move[0]);
    const nodes = cards.map(card => [...piles[source].querySelectorAll('.card')].find(node => node.dataset.card === card)).filter(Boolean);
    nodes.forEach(node => node.classList.add('selected'));
    const call = moves.call || '';
    if (call) { $('call-banner').textContent = call; $('call-banner').classList.add('show'); await sleep(3000); $('call-banner').classList.remove('show'); await sleep(250); }
    const sourceRects = nodes.map(node => node.getBoundingClientRect());
    cards.forEach(card => { const i = state[source].indexOf(card); if (i !== -1) state[source].splice(i, 1); }); render(source);
    const targets = cards.map((_, i) => targetRect('DISCARD', state.DISCARD.length + i, state.DISCARD.length + cards.length));
    await Promise.all(cards.map((card, i) => fly(card, sourceRects[i], targets[i])));
    state.DISCARD.push(...cards); render('DISCARD');
  }
  async function executeStep(step) {
    const moves = step.moves || [];
    const discards = moves.filter(move => move[2] === 'DISCARD');
    if (discards.length) { discards.call = step.call; await discardGroup(discards); return; }
    for (const [card, from, to] of moves) { if (from === 'DRAW') await draw(card, to); }
  }
  async function run() {
    try {
      const response = await fetch(`simdata/${encodeURIComponent(SIMULATION)}/simulation.json`);
      if (!response.ok) throw new Error(`Could not load simulation ${SIMULATION}`);
      const data = await response.json();
      $('turn-label').textContent = `SIMULATION ${SIMULATION}`; $('step-label').textContent = 'Starting in 3.5 seconds';
      await sleep(3500);
      for (let turnIndex = 0; turnIndex < data.turns.length; turnIndex++) {
        const steps = data.turns[turnIndex].steps || [];
        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
          const step = steps[stepIndex]; setStatus(turnIndex + 1, `STEP ${stepIndex + 1}: ${step.summary || ''}`);
          await sleep(2000); await executeStep(step);
        }
      }
      $('turn-label').textContent = 'SIMULATION COMPLETE'; $('step-label').textContent = SIMULATION;
    } catch (error) { $('turn-label').textContent = 'SIMULATION ERROR'; $('step-label').textContent = error.message; console.error(error); }
  }
  run();
})();
