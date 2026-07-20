/* Change this value to select the default simulation. It can also be overridden
   without editing this file: index.html?sim=S2 */
const CONFIG = Object.freeze({
  simulation: "S1",
  initialWait: 3500,
  stepWait: 2000,
  initialDrawDuration: 200,
  drawDuration: 400,
  discardDuration: 200,
  discardStagger: 30,
  callDuration: 3000,
  handSpacing: 27.5
});

const requestedLanguage = new URLSearchParams(location.search).get("lang");
const language = requestedLanguage === "id" ? "id" : "en";
const messages = {
  en: {
    title: "Anak Bos Troika — Simulation",
    ariaLabel: "Anak Bos Troika game simulation",
    rule: "DISCARDS CARD GROUPS THAT ALL HAVE MATCHING ASPECT, OR SERIES OF 6+ DIFFERENT CATEGORIES/COLORS",
    ready: "GET READY",
    loading: "Simulation loading…",
    hand: "HAND",
    discard: "DISCARD",
    pile: "PILE",
    starting: simulation => `Simulation ${simulation} · starting shortly`,
    turn: (turn, step, total) => `Turn ${turn} · Step ${step}/${total}`,
    complete: "Simulation complete",
    finished: "All turns finished",
    simulationError: "Simulation error",
    unable: "Unable to continue",
    loadError: (simulation, status) => `Could not load simulation ${simulation} (${status}).`,
    noJson: simulation => `Simulation ${simulation} contains no JSON object.`,
    serveHint: "Serve this folder through a local web server (for example: python3 -m http.server) instead of opening index.html directly."
  },
  id: {
    title: "Anak Bos Troika — Simulasi",
    ariaLabel: "Simulasi permainan Anak Bos Troika",
    rule: "BUANG GRUP KARTU DENGAN ASPEK SAMA, ATAU SERI 6+ KARTU DENGAN KATEGORI/WARNA BERBEDA",
    ready: "BERSIAP",
    loading: "Memuat simulasi…",
    hand: "KARTU",
    discard: "TUMPUKAN",
    pile: "BUANGAN",
    starting: simulation => `Simulasi ${simulation} · segera dimulai`,
    turn: (turn, step, total) => `Giliran ${turn} · Langkah ${step}/${total}`,
    complete: "Simulasi selesai",
    finished: "Semua giliran selesai",
    simulationError: "Kesalahan simulasi",
    unable: "Tidak dapat melanjutkan",
    loadError: (simulation, status) => `Tidak dapat memuat simulasi ${simulation} (${status}).`,
    noJson: simulation => `Simulasi ${simulation} tidak berisi objek JSON.`,
    serveHint: "Jalankan folder ini melalui server web lokal (misalnya: python3 -m http.server), bukan dengan membuka index.html secara langsung."
  }
};
const t = messages[language];

function applyLanguage() {
  document.documentElement.lang = language;
  document.title = t.title;
  document.querySelector("#animation").setAttribute("aria-label", t.ariaLabel);
  document.querySelector("#game-rule").textContent = t.rule;
  document.querySelectorAll("[data-i18n]").forEach(element => {
    element.textContent = t[element.dataset.i18n];
  });
  document.querySelector("#turn-info").textContent = t.ready;
  document.querySelector("#step-info").textContent = t.loading;
}

function simulationText(text) {
  if (language !== "id" || !text) return text || "";
  return text
    .replace(/^INITIAL DRAW$/i, "PEMBAGIAN KARTU AWAL")
    .replace(/\bCALLS\b/gi, "MENYEBUT")
    .replace(/\bDISCARDS GROUP\b/gi, "MEMBUANG GRUP")
    .replace(/\bDISCARDS SERIES\b/gi, "MEMBUANG SERI")
    .replace(/\bDRAWS ANOTHER (\d+) CARDS?\b/gi, "MENGAMBIL $1 KARTU LAGI")
    .replace(/\bPASSES\b/gi, "LEWAT")
    .replace(/\bCATEGORIES\b/gi, "KATEGORI")
    .replace(/\bCOLORS\b/gi, "WARNA")
    .replace(/\bWINS\b/gi, "MENANG")
    .replace(/\bBLUE\b/gi, "BIRU")
    .replace(/\bMEDIUM\b/gi, "SEDANG")
    .replace(/\bSMALL\b/gi, "KECIL")
    .replace(/\bRECTANGLE\b/gi, "PERSEGI PANJANG")
    .replace(/\bROUND\b/gi, "BULAT")
    .replace(/\bTRIANGLE\b/gi, "SEGITIGA");
}

applyLanguage();

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

function layoutPile(pileName, spacingOverride = null) {
  const cards = state[pileName];
  const spacing = spacingOverride ?? spacingFor(pileName, cards.length);
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

async function flyCard(name, from, to, duration, options = {}) {
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

  const end = options.target || targetPosition(to);
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
  layoutPile(to, options.destinationSpacing);
}

async function flyDiscardGroup(moves) {
  const rootRect = root.getBoundingClientRect();
  const pileRect = piles.DISCARD.getBoundingClientRect();
  const startingCount = state.DISCARD.length;
  const finalCount = startingCount + moves.length;
  const finalSpacing = spacingFor("DISCARD", finalCount);

  // Compress the existing pile to its final spacing before reserving landing
  // positions for all concurrently moving cards.
  layoutPile("DISCARD", finalSpacing);

  await Promise.all(moves.map(async ([name, from, to], index) => {
    await sleep(index * CONFIG.discardStagger);
    return flyCard(name, from, to, CONFIG.discardDuration, {
      target: {
        x: pileRect.left - rootRect.left + (startingCount + index) * finalSpacing,
        y: pileRect.top - rootRect.top
      },
      destinationSpacing: finalSpacing
    });
  }));

  layoutPile("DISCARD");
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
  callout.textContent = simulationText(text);
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

  if (isDiscard) {
    await flyDiscardGroup(step.moves);
  } else {
    for (const [name, from, to] of step.moves || []) {
      await flyCard(name, from, to,
        isInitialDraw ? CONFIG.initialDrawDuration : CONFIG.drawDuration);
    }
  }
}

async function start() {
  const requested = new URLSearchParams(location.search).get("sim");
  const simulation = requested || CONFIG.simulation;
  const response = await fetch(`simdata/${encodeURIComponent(simulation)}/simulation.json`);
  if (!response.ok) throw new Error(t.loadError(simulation, response.status));
  // Some generated simulation files contain converter diagnostics before the
  // opening brace. Ignore that harmless prefix while keeping strict JSON for
  // the actual simulation object.
  const raw = await response.text();
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) throw new Error(t.noJson(simulation));
  const data = JSON.parse(raw.slice(jsonStart));

  stepInfo.textContent = t.starting(simulation);
  await sleep(CONFIG.initialWait);

  for (let turnIndex = 0; turnIndex < data.turns.length; turnIndex++) {
    const steps = data.turns[turnIndex].steps || [];
    for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
      const step = steps[stepIndex];
      turnInfo.textContent = t.turn(turnIndex + 1, stepIndex + 1, steps.length);
      stepInfo.textContent = simulationText(step.summary);
      setActivePlayer(playerForStep(step));
      await sleep(CONFIG.stepWait);
      await runStep(step, turnIndex === 0);
    }
  }

  setActivePlayer(null);
  turnInfo.textContent = t.complete;
  stepInfo.textContent = t.finished;
}

start().catch(error => {
  console.error(error);
  const box = document.querySelector("#error");
  box.hidden = false;
  box.textContent = `${error.message} ${t.serveHint}`;
  turnInfo.textContent = t.simulationError;
  stepInfo.textContent = t.unable;
});
