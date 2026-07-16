/* Change this value to select the default simulation. It can also be overridden
   without editing this file: index.html?sim=S2 */
const CONFIG = Object.freeze({
  simulation: "S1",
  initialWait: 3500,
  stepWait: 2000,
  initialDrawDuration: 200,
  drawDuration: 400,
  discardDuration: 200,
  callDuration: 3000,
  handSpacing: 27.5
});

const state = { P1: [], P2: [], DISCARD: [] };
const root = document.querySelector("#animation");
const piles = {
  P1: document.querySelector("#p1-pile"),
  P2: document.querySelector("#p2-pile"),
  DISCARD: document.querySelector("#discard-pile")
};
const labels = {
  P1: document.querySelector("#p1-label"),
  P2: document.querySelector("#p2-label")
};
const flyingLayer = document.querySelector("#flying-layer");
const turnInfo = document.querySelector("#turn-info");
const stepInfo = document.querySelector("#step-info");
const callout = document.querySelector("#callout");

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const cardSrc = name => `cards-front/${encodeURIComponent(name)}.png`;

function spacingFor(pile, count) {
  if (pile !== "DISCARD") return CONFIG.handSpacing;
  if (count >= 20) return 16.5;
  if (count >= 12) return 20.625;
  return 27.5;
}

function makeCard(name) {
  const image = new Image();
  image.className = "card";
  image.src = cardSrc(name);
  image.alt = name;
  image.dataset.card = name;
  image.draggable = false;
  return image;
}

function layoutPile(pileName) {
  const cards = state[pileName];
  const spacing = spacingFor(pileName, cards.length);
  cards.forEach((card, index) => {
    card.style.left = `${index * spacing}px`;
    card.style.zIndex = index + 1;
  });
}

function setActivePlayer(player) {
  Object.entries(labels).forEach(([name, label]) => {
    label.classList.toggle("active", name === player);
  });
}

function playerForStep(step) {
  const move = step.moves?.[0];
  if (!move) return null;
  return move[1] === "DRAW" ? move[2] : move[1];
}

function targetPosition(pileName) {
  const pileRect = piles[pileName].getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const count = state[pileName].length;
  const futureCount = count + 1;
  return {
    x: pileRect.left - rootRect.left + count * spacingFor(pileName, futureCount),
    y: pileRect.top - rootRect.top
  };
}

async function flyCard(name, from, to, duration) {
  const rootRect = root.getBoundingClientRect();
  let sourceCard = null;
  let start;

  if (from === "DRAW") {
    start = { x: -170, y: (1080 - 257) / 2 };
  } else {
    sourceCard = state[from].find(card => card.dataset.card === name);
    if (!sourceCard) throw new Error(`Card “${name}” was not found in ${from}.`);
    const rect = sourceCard.getBoundingClientRect();
    start = { x: rect.left - rootRect.left, y: rect.top - rootRect.top };
  }

  const end = targetPosition(to);
  const flyer = makeCard(name);
  flyer.classList.add("flying-card");
  flyer.style.left = `${start.x}px`;
  flyer.style.top = `${start.y}px`;
  flyingLayer.appendChild(flyer);

  if (sourceCard) {
    const index = state[from].indexOf(sourceCard);
    state[from].splice(index, 1);
    sourceCard.remove();
    layoutPile(from);
  }

  await flyer.animate([
    { transform: "translate(0, 0) scale(1)", offset: 0 },
    { transform: `translate(${(end.x - start.x) * .52}px, ${(end.y - start.y) * .52 - 24}px) scale(1.035)`, offset: .52 },
    { transform: `translate(${end.x - start.x}px, ${end.y - start.y}px) scale(1)`, offset: 1 }
  ], { duration, easing: "cubic-bezier(.34,.1,.2,1)", fill: "forwards" }).finished;

  flyer.remove();
  const finalCard = makeCard(name);
  piles[to].appendChild(finalCard);
  state[to].push(finalCard);
  layoutPile(to);
}

function highlightDiscardCards(step) {
  const byPile = new Map();
  for (const [name, from, to] of step.moves) {
    if (to !== "DISCARD") continue;
    if (!byPile.has(from)) byPile.set(from, new Set());
    const used = byPile.get(from);
    const match = state[from].find(card => card.dataset.card === name && !used.has(card));
    if (!match) throw new Error(`Cannot highlight “${name}”; it is not in ${from}.`);
    used.add(match);
    match.classList.add("highlighted");
  }
}

async function showCall(text) {
  callout.textContent = text;
  callout.classList.add("visible");
  await sleep(CONFIG.callDuration);
  callout.classList.remove("visible");
  await sleep(220);
}

async function runStep(step, isInitialDraw = false) {
  const isDiscard = step.moves?.some(move => move[2] === "DISCARD");
  if (isDiscard) {
    highlightDiscardCards(step);
    if (step.call) await showCall(step.call);
  }

  for (const [name, from, to] of step.moves || []) {
    await flyCard(name, from, to,
      from === "DRAW"
        ? (isInitialDraw ? CONFIG.initialDrawDuration : CONFIG.drawDuration)
        : CONFIG.discardDuration);
  }
}

async function start() {
  const requested = new URLSearchParams(location.search).get("sim");
  const simulation = requested || CONFIG.simulation;
  const response = await fetch(`simdata/${encodeURIComponent(simulation)}/simulation.json`);
  if (!response.ok) throw new Error(`Could not load simulation ${simulation} (${response.status}).`);
  // Some generated simulation files contain converter diagnostics before the
  // opening brace. Ignore that harmless prefix while keeping strict JSON for
  // the actual simulation object.
  const raw = await response.text();
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) throw new Error(`Simulation ${simulation} contains no JSON object.`);
  const data = JSON.parse(raw.slice(jsonStart));

  stepInfo.textContent = `Simulation ${simulation} · starting shortly`;
  await sleep(CONFIG.initialWait);

  for (let turnIndex = 0; turnIndex < data.turns.length; turnIndex++) {
    const steps = data.turns[turnIndex].steps || [];
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      turnInfo.textContent = `Turn ${turnIndex + 1} · Step ${stepIndex + 1}/${steps.length}`;
      stepInfo.textContent = step.summary || "";
      setActivePlayer(playerForStep(step));
      await sleep(CONFIG.stepWait);
      await runStep(step, turnIndex === 0);
    }
  }

  setActivePlayer(null);
  turnInfo.textContent = "Simulation complete";
  stepInfo.textContent = "All turns finished";
}

start().catch(error => {
  console.error(error);
  const box = document.querySelector("#error");
  box.hidden = false;
  box.textContent = `${error.message} Serve this folder through a local web server (for example: python3 -m http.server) instead of opening index.html directly.`;
  turnInfo.textContent = "Simulation error";
  stepInfo.textContent = "Unable to continue";
});
