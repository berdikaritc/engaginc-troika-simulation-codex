(() => {
  'use strict';

  // Use index.html?sim=S2 to play simdata/S2/simulation.json.
  const DEFAULT_SIMULATION = 'S1';
  const CARD_WIDTH = 165;
  const HAND_GAP = CARD_WIDTH / 6;
  const DRAW_TIME = 400;
  const DISCARD_TIME = 750;
  const STEP_DELAY = 2000;
  const START_DELAY = 3500;
  const CALLOUT_TIME = 3000;

  const stage = document.querySelector('#stage');
  const piles = { P1: [], P2: [], DISCARD: [] };
  const pileEls = {
    P1: document.querySelector('#pile-p1'),
    P2: document.querySelector('#pile-p2'),
    DISCARD: document.querySelector('#pile-discard')
  };
  const laneEls = {
    P1: document.querySelector('#lane-p1'),
    P2: document.querySelector('#lane-p2')
  };
  const turnInfo = document.querySelector('#turn-info');
  const summary = document.querySelector('#step-summary');
  const callout = document.querySelector('#callout');
  const discardCount = document.querySelector('#discard-count');

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  function simulationName() {
    const requested = new URLSearchParams(location.search).get('sim') || DEFAULT_SIMULATION;
    return /^[A-Za-z0-9_-]+$/.test(requested) ? requested : DEFAULT_SIMULATION;
  }

  function cardSrc(name) {
    return `cards-front/${encodeURIComponent(name)}.png`;
  }

  function spacing(pile, count = piles[pile].length) {
    if (pile !== 'DISCARD') return HAND_GAP;
    if (count >= 20) return CARD_WIDTH / 10;
    if (count >= 12) return CARD_WIDTH / 8;
    return HAND_GAP;
  }

  function makeCard(name) {
    const img = document.createElement('img');
    img.className = 'card';
    img.src = cardSrc(name);
    img.alt = name;
    img.dataset.name = name;
    img.draggable = false;
    return { name, el: img };
  }

  function layoutPile(pile) {
    const gap = spacing(pile);
    piles[pile].forEach((card, index) => {
      card.el.style.left = `${20 + index * gap}px`;
      card.el.style.top = '27px';
      card.el.style.zIndex = index + 1;
    });
    if (pile === 'DISCARD') {
      const n = piles.DISCARD.length;
      discardCount.textContent = `${n} CARD${n === 1 ? '' : 'S'}`;
    }
  }

  function targetPosition(pile, futureIndex, futureCount) {
    const laneRect = pileEls[pile].getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      left: laneRect.left - stageRect.left + 20 + futureIndex * spacing(pile, futureCount),
      top: laneRect.top - stageRect.top + 27
    };
  }

  function setActivePlayer(player) {
    Object.entries(laneEls).forEach(([name, el]) => el.classList.toggle('active', name === player));
  }

  function playerForStep(step, turnIndex) {
    const discard = step.moves?.find(move => move[1] === 'P1' || move[1] === 'P2');
    if (discard) return discard[1];
    const draw = step.moves?.find(move => move[2] === 'P1' || move[2] === 'P2');
    if (turnIndex === 0 && step.moves?.some(move => move[2] === 'P1') && step.moves?.some(move => move[2] === 'P2')) return null;
    return draw?.[2] || null;
  }

  function findCard(pile, name) {
    const index = piles[pile].findIndex(card => card.name === name);
    if (index < 0) throw new Error(`Card “${name}” was not found in ${pile}.`);
    return { card: piles[pile][index], index };
  }

  async function drawCard(name, targetPile) {
    const card = makeCard(name);
    const finalCount = piles[targetPile].length + 1;
    const target = targetPosition(targetPile, finalCount - 1, finalCount);
    card.el.classList.add('moving');
    card.el.style.setProperty('--move-time', `${DRAW_TIME}ms`);
    card.el.style.left = `${-CARD_WIDTH}px`;
    card.el.style.top = `${target.top}px`;
    stage.append(card.el);
    await frame();
    card.el.style.left = `${target.left}px`;
    await wait(DRAW_TIME);
    card.el.classList.remove('moving');
    pileEls[targetPile].append(card.el);
    piles[targetPile].push(card);
    layoutPile(targetPile);
  }

  async function discardCard(name, sourcePile) {
    const { card, index } = findCard(sourcePile, name);
    const sourceRect = card.el.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const finalCount = piles.DISCARD.length + 1;
    const target = targetPosition('DISCARD', finalCount - 1, finalCount);

    piles[sourcePile].splice(index, 1);
    card.el.classList.remove('highlighted');
    card.el.classList.add('moving');
    card.el.style.setProperty('--move-time', `${DISCARD_TIME}ms`);
    card.el.style.left = `${sourceRect.left - stageRect.left}px`;
    card.el.style.top = `${sourceRect.top - stageRect.top}px`;
    stage.append(card.el);
    layoutPile(sourcePile);
    await frame();
    card.el.style.left = `${target.left}px`;
    card.el.style.top = `${target.top}px`;
    await wait(DISCARD_TIME);
    card.el.classList.remove('moving');
    pileEls.DISCARD.append(card.el);
    piles.DISCARD.push(card);
    layoutPile('DISCARD');
  }

  async function showCall(value) {
    callout.textContent = value;
    callout.classList.add('show');
    await wait(CALLOUT_TIME);
    callout.classList.remove('show');
    await wait(220);
  }

  async function playStep(step, turnIndex, stepIndex, stepCount) {
    turnInfo.textContent = `TURN ${turnIndex + 1}  •  STEP ${stepIndex + 1}/${stepCount}`;
    summary.textContent = step.summary || '';
    setActivePlayer(playerForStep(step, turnIndex));
    await wait(STEP_DELAY);

    const discards = (step.moves || []).filter(move => move[2] === 'DISCARD');
    if (discards.length) {
      discards.forEach(([name, source]) => findCard(source, name).card.el.classList.add('highlighted'));
      await wait(350);
      if (step.call !== undefined && step.call !== null) await showCall(String(step.call));
    }

    for (const [name, from, to] of step.moves || []) {
      if (from === 'DRAW' && (to === 'P1' || to === 'P2')) await drawCard(name, to);
      else if ((from === 'P1' || from === 'P2') && to === 'DISCARD') await discardCard(name, from);
      else throw new Error(`Unsupported move: ${name}, ${from} → ${to}`);
    }
  }

  async function run() {
    const sim = simulationName();
    const response = await fetch(`simdata/${encodeURIComponent(sim)}/simulation.json`);
    if (!response.ok) throw new Error(`Could not load simulation “${sim}” (${response.status}).`);
    // Some simulation generators print diagnostics before the JSON payload.
    // Start at the first object so those harmless lines do not stop playback.
    const raw = await response.text();
    const jsonStart = raw.indexOf('{');
    if (jsonStart < 0) throw new Error(`Simulation “${sim}” does not contain JSON.`);
    const data = JSON.parse(raw.slice(jsonStart));
    await wait(START_DELAY);

    for (let turnIndex = 0; turnIndex < data.turns.length; turnIndex++) {
      const steps = data.turns[turnIndex].steps || [];
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
        await playStep(steps[stepIndex], turnIndex, stepIndex, steps.length);
      }
    }
    setActivePlayer(null);
    turnInfo.textContent = 'SIMULATION COMPLETE';
    summary.textContent = `${sim} • ${piles.P1.length} cards in P1 • ${piles.P2.length} cards in P2`;
  }

  run().catch(error => {
    console.error(error);
    const box = document.querySelector('#error');
    box.hidden = false;
    box.textContent = `Simulation error: ${error.message} Serve this folder through a local web server; browsers do not permit fetch() from file:// pages.`;
  });
})();
