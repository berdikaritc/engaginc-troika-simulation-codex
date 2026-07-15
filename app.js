/* Change this default, or open index.html?simulation=S2, to choose a simulation. */
const DEFAULT_SIMULATION = 'S1';
const START_DELAY_MS = 3500;
const STEP_DELAY_MS = 2000;
const MOVE_DURATION_MS = 1500;

const simulationId = new URLSearchParams(window.location.search).get('simulation') || DEFAULT_SIMULATION;
const piles = { P1: [], P2: [], DISCARD: [] };
const elements = {
  P1: document.querySelector('#p1-pile'),
  P2: document.querySelector('#p2-pile'),
  DISCARD: document.querySelector('#discard-pile'),
  layer: document.querySelector('#animation-layer'),
  turn: document.querySelector('#turn-label'),
  summary: document.querySelector('#step-summary'),
  call: document.querySelector('#call-overlay')
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cardUrl = card => `cards-front/${encodeURIComponent(card)}.png`;
function cardWidth() {
  // Custom properties retain their `clamp()` text in getComputedStyle, so resolve
  // the same responsive rule here for precise flight destinations.
  if (window.innerHeight < 700) return Math.min(125, Math.max(90, window.innerWidth * 0.18));
  return Math.min(150, Math.max(112, window.innerWidth * 0.21));
}

function spacingFor(pileName, count) {
  const width = cardWidth();
  if (pileName !== 'DISCARD') return width / 7;
  if (count >= 20) return width / 11;
  if (count >= 12) return width / 9;
  return width / 7;
}

function positionFor(pileName, index, total) {
  const rect = elements[pileName].getBoundingClientRect();
  const width = cardWidth();
  const naturalSpacing = spacingFor(pileName, total);
  // Keep even very long discard piles inside the recording frame.
  const available = Math.max(0, rect.width - width - 12);
  const spacing = total > 1 ? Math.min(naturalSpacing, available / (total - 1)) : naturalSpacing;
  return { left: rect.left + 6 + index * spacing, top: rect.top + (rect.height - width * 1029 / 662) / 2 };
}

function renderPile(pileName, highlightedCards = []) {
  const pile = elements[pileName];
  pile.replaceChildren();
  const cards = piles[pileName];
  cards.forEach((card, index) => {
    const position = positionFor(pileName, index, cards.length);
    const image = document.createElement('img');
    image.className = `game-card${highlightedCards.includes(card) ? ' highlighted' : ''}`;
    image.src = cardUrl(card);
    image.alt = card;
    image.style.left = `${position.left - pile.getBoundingClientRect().left}px`;
    image.dataset.card = card;
    pile.append(image);
  });
}

function renderAll(highlights = {}) {
  renderPile('P1', highlights.P1 || []);
  renderPile('P2', highlights.P2 || []);
  renderPile('DISCARD', highlights.DISCARD || []);
}

function makeFlyingCard(card, from, to) {
  const image = document.createElement('img');
  image.className = 'flying-card';
  image.src = cardUrl(card);
  image.alt = '';
  image.style.left = `${to.left}px`;
  image.style.top = `${to.top}px`;
  elements.layer.append(image);
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  return { image, keyframes: [{ transform: `translate(${dx}px, ${dy}px) scale(.94)` }, { transform: 'translate(0, 0) scale(1)' }] };
}

async function drawCard(card, destination) {
  const finalIndex = piles[destination].length;
  const target = positionFor(destination, finalIndex, finalIndex + 1);
  const start = { left: -cardWidth() - 16, top: window.innerHeight / 2 - cardWidth() * 1029 / 662 / 2 };
  const flight = makeFlyingCard(card, start, target);
  await flight.image.animate(flight.keyframes, { duration: MOVE_DURATION_MS, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' }).finished;
  flight.image.remove();
  piles[destination].push(card);
  renderPile(destination);
}

async function discardGroup(moves, source) {
  const discardedCards = moves.map(([card]) => card);
  for (const card of discardedCards) {
    if (!piles[source].includes(card)) throw new Error(`${card} is not in ${source}`);
  }
  renderPile(source, discardedCards);
  const call = moves.call || '';
  if (call) {
    elements.call.textContent = call;
    elements.call.classList.add('visible');
    await sleep(3000);
    elements.call.classList.remove('visible');
  }

  const sourceCards = [...piles[source]];
  const destinationStart = piles.DISCARD.length;
  const finalDestinationTotal = destinationStart + moves.length;
  const flights = moves.map((move, moveIndex) => {
    const card = move[0];
    const sourceIndex = sourceCards.lastIndexOf(card);
    const sourcePosition = positionFor(source, sourceIndex, sourceCards.length);
    const target = positionFor('DISCARD', destinationStart + moveIndex, finalDestinationTotal);
    return makeFlyingCard(card, sourcePosition, target);
  });
  piles[source] = sourceCards.filter(card => !moves.some(move => move[0] === card));
  renderPile(source);
  await Promise.all(flights.map(flight => flight.image.animate(flight.keyframes, {
    duration: MOVE_DURATION_MS, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards'
  }).finished));
  flights.forEach(flight => flight.image.remove());
  piles.DISCARD.push(...moves.map(move => move[0]));
  renderPile('DISCARD');
}

async function runStep(step, turnNumber, stepNumber, waitBefore = true) {
  elements.turn.textContent = `TURN ${turnNumber} · STEP ${stepNumber}`;
  elements.summary.textContent = step.summary || '';
  if (waitBefore) await sleep(STEP_DELAY_MS);
  const moves = step.moves || [];
  const isDiscard = moves.length && moves.every(([, from, to]) => (from === 'P1' || from === 'P2') && to === 'DISCARD');
  if (isDiscard) {
    moves.call = step.call;
    await discardGroup(moves, moves[0][1]);
    return;
  }
  for (const [card, from, to] of moves) {
    if (from !== 'DRAW' || !(to in piles)) throw new Error(`Unsupported move: ${card}, ${from}, ${to}`);
    await drawCard(card, to);
  }
}

async function start() {
  try {
    elements.turn.textContent = `SIMULATION ${simulationId} · STARTING`;
    const response = await fetch(`simdata/${encodeURIComponent(simulationId)}/simulation.json`);
    if (!response.ok) throw new Error(`Could not load simulation ${simulationId}`);
    const data = await response.json();
    renderAll();
    await sleep(START_DELAY_MS);
    for (let turnIndex = 0; turnIndex < data.turns.length; turnIndex++) {
      const steps = data.turns[turnIndex].steps || [];
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
        await runStep(steps[stepIndex], turnIndex + 1, stepIndex + 1, turnIndex !== 0 || stepIndex !== 0);
      }
    }
    elements.turn.textContent = `SIMULATION ${simulationId} · COMPLETE`;
    elements.summary.textContent = 'GAMEPLAY COMPLETE';
  } catch (error) {
    console.error(error);
    elements.turn.textContent = 'SIMULATION ERROR';
    elements.summary.textContent = error.message;
  }
}

start();
