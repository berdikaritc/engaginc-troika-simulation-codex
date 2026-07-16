let simulationData = null;
let nextCardId = 1;

let state = {
  p1: [],      // Array of { id, name, element, highlighted, isMoving }
  p2: [],      // Array of { id, name, element, highlighted, isMoving }
  discard: [], // Array of { id, name, element, highlighted, isMoving }

  currentTurnIndex: 0,
  currentStepIndex: 0,
  currentMoveIndex: 0,

  isPlaying: false,
  isWaitingForNextStep: false,
  isWaitingForCall: false,
  autoAdvance: true,

  // Settings (seconds)
  playbackSpeed: 1.0,
  drawDuration: 1.5,
  discardDuration: 1.5,
  staggerDelay: 1.5, // 1.5s is fully sequential (no overlap), lower values allow stagger/overlap
  stepDelay: 2.0,
  initialDelay: 3.5,
  callDuration: 3.0,
};

let activeTimeouts = [];

// DOM Elements
const sidebar = document.getElementById('sidebar');
const btnShowSidebar = document.getElementById('btn-show-sidebar');
const btnHideSidebar = document.getElementById('btn-hide-sidebar');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnRestart = document.getElementById('btn-restart');
const btnLoad = document.getElementById('btn-load');
const simCaseInput = document.getElementById('sim-case');
const stepListContainer = document.getElementById('step-list');
const slideSpeed = document.getElementById('slide-speed');
const valSpeed = document.getElementById('val-speed');
const slideStagger = document.getElementById('slide-stagger');
const valStagger = document.getElementById('val-stagger');
const btnToggleAuto = document.getElementById('btn-toggle-auto');

const turnDisplay = document.getElementById('turn-display');
const summaryDisplay = document.getElementById('summary-display');
const cardsLayer = document.getElementById('cards-layer');
const callOverlay = document.getElementById('call-overlay');
const callOverlayTitle = document.getElementById('call-overlay-title');
const callOverlayText = document.getElementById('call-overlay-text');
const toastEl = document.getElementById('toast');

// Initialize App
setupEventListeners();
loadSimulation(simCaseInput.value.trim());


// Load Simulation JSON
async function loadSimulation(caseName) {
  if (!caseName) {
    showToast("Please enter a simulation name!");
    return;
  }

  showToast(`Loading simulation ${caseName}...`);
  pause();

  try {
    const response = await fetch(`simdata/${caseName}/simulation.json`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    simulationData = await response.json();
    showToast(`Simulation ${caseName} loaded successfully!`);

    buildStepList();
    goToShowStep(0, 0);

    // Automatically trigger initial delay and start play
    play();
  } catch (error) {
    console.error("Error loading simulation JSON:", error);
    showToast(`Failed to load: simdata/${caseName}/simulation.json`, true);
  }
}

// Build Step List Sidebar Checklist
function buildStepList() {
  stepListContainer.innerHTML = '';
  if (!simulationData || !simulationData.turns) return;

  simulationData.turns.forEach((turn, turnIdx) => {
    turn.steps.forEach((step, stepIdx) => {
      const item = document.createElement('div');
      item.className = 'step-item';
      item.id = `step-item-${turnIdx}-${stepIdx}`;

      const titleText = `Turn ${turnIdx + 1}, Step ${stepIdx + 1}`;
      item.innerHTML = `
        <div class="step-item-title">${titleText}</div>
        <div class="step-item-summary">${step.summary || 'Move'}</div>
      `;

      item.addEventListener('click', () => {
        goToShowStep(turnIdx, stepIdx);
      });

      stepListContainer.appendChild(item);
    });
  });
}

// Update Step List Highlight in Sidebar
function updateStepListHighlight() {
  document.querySelectorAll('.step-item').forEach(el => el.classList.remove('active'));

  const activeEl = document.getElementById(`step-item-${state.currentTurnIndex}-${state.currentStepIndex}`);
  if (activeEl) {
    activeEl.classList.add('active');
    activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

// Show Toast
function showToast(message, isError = false) {
  toastEl.textContent = message;
  if (isError) {
    toastEl.style.borderColor = "#ff4a4a";
  } else {
    toastEl.style.borderColor = "var(--gold)";
  }
  toastEl.classList.add('show');

  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3000);
}

// Setup Event Listeners
function setupEventListeners() {
  // Load Button
  btnLoad.addEventListener('click', () => {
    loadSimulation(simCaseInput.value.trim());
  });
  simCaseInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      loadSimulation(simCaseInput.value.trim());
    }
  });

  // Play / Pause
  btnPlay.addEventListener('click', togglePlay);

  // Prev / Next / Restart
  btnPrev.addEventListener('click', stepBackward);
  btnNext.addEventListener('click', stepForward);
  btnRestart.addEventListener('click', restart);

  // Speed Slider
  slideSpeed.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.playbackSpeed = val;
    valSpeed.textContent = val.toFixed(2) + 'x';
    // Dynamically adjust ongoing transitions if any
    layoutCards(true);
  });

  // Stagger Slider
  slideStagger.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.staggerDelay = val;
    valStagger.textContent = val.toFixed(1) + 's';
  });

  // Auto Advance Toggle
  btnToggleAuto.addEventListener('click', () => {
    state.autoAdvance = !state.autoAdvance;
    if (state.autoAdvance) {
      btnToggleAuto.classList.add('active');
      btnToggleAuto.textContent = 'Auto-Advance Steps';
    } else {
      btnToggleAuto.classList.remove('active');
      btnToggleAuto.textContent = 'Manual Step Control';
    }
  });

  // Sidebar visibility
  btnHideSidebar.addEventListener('click', hideSidebar);
  btnShowSidebar.addEventListener('click', showSidebar);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Prevent default scrolling for Space and Arrow keys when playing/navigating
    if (['Space', 'ArrowLeft', 'ArrowRight', 'KeyR', 'KeyH'].includes(e.code)) {
      if (document.activeElement.tagName === 'INPUT') return; // Don't intercept inputs
      e.preventDefault();
    }

    switch (e.code) {
      case 'Space':
        togglePlay();
        break;
      case 'ArrowLeft':
        stepBackward();
        break;
      case 'ArrowRight':
        stepForward();
        break;
      case 'KeyR':
        restart();
        break;
      case 'KeyH':
        toggleSidebar();
        break;
    }
  });
}

// Sidebar Visibility Actions
function hideSidebar() {
  sidebar.classList.add('hidden');
  btnShowSidebar.classList.remove('hidden');
}

function showSidebar() {
  sidebar.classList.remove('hidden');
  btnShowSidebar.classList.add('hidden');
}

function toggleSidebar() {
  if (sidebar.classList.contains('hidden')) {
    showSidebar();
  } else {
    hideSidebar();
  }
}

// Play / Pause Logic
function togglePlay() {
  if (state.isPlaying) {
    pause();
  } else {
    play();
  }
}

function play() {
  if (state.isPlaying) return;
  if (!simulationData) {
    showToast("No simulation loaded!");
    return;
  }

  state.isPlaying = true;
  updatePlayPauseButton();

  // Start executing the current step
  runCurrentStep();
}

function pause() {
  if (!state.isPlaying) return;

  state.isPlaying = false;
  updatePlayPauseButton();

  // Clear all scheduled timeouts
  activeTimeouts.forEach(clearTimeout);
  activeTimeouts = [];

  // If paused during sequential deal, keep track of currentMoveIndex so we can resume
  // If paused during waiting or call announcement, we reset state flags so they resume clean
  state.isWaitingForNextStep = false;
  state.isWaitingForCall = false;
}

function updatePlayPauseButton() {
  if (state.isPlaying) {
    btnPlay.classList.add('paused');
    btnPlay.textContent = '⏸ PAUSE';
  } else {
    btnPlay.classList.remove('paused');
    btnPlay.textContent = '▶ PLAY';
  }
}

// Restart Logic
function restart() {
  if (!simulationData) return;
  goToShowStep(0, 0);
  play();
  showToast("Simulation restarted!");
}

// Step Navigation
function stepForward() {
  if (!simulationData) return;
  pause();

  let t = state.currentTurnIndex;
  let s = state.currentStepIndex + 1;

  if (s >= simulationData.turns[t].steps.length) {
    s = 0;
    t++;
  }

  if (t < simulationData.turns.length) {
    goToShowStep(t, s);
    showToast(`Stepped Forward to Turn ${t+1}, Step ${s+1}`);
  } else {
    showToast("Already at the end!");
  }
}

function stepBackward() {
  if (!simulationData) return;
  pause();

  let t = state.currentTurnIndex;
  let s = state.currentStepIndex - 1;

  if (s < 0) {
    t--;
    if (t >= 0) {
      s = simulationData.turns[t].steps.length - 1;
    }
  }

  if (t >= 0) {
    goToShowStep(t, s);
    showToast(`Stepped Backward to Turn ${t+1}, Step ${s+1}`);
  } else {
    showToast("Already at the beginning!");
  }
}

// Jump and snap state instantly to beginning of turnIndex, stepIndex
function goToShowStep(turnIndex, stepIndex) {
  // 1. Clear all active timers
  activeTimeouts.forEach(clearTimeout);
  activeTimeouts = [];

  // 2. Clear call overlay
  hideCallOverlay();

  // 3. Clear all DOM elements from cards layer
  cardsLayer.innerHTML = '';

  // 4. Reset state model
  state.p1 = [];
  state.p2 = [];
  state.discard = [];
  state.currentTurnIndex = turnIndex;
  state.currentStepIndex = stepIndex;
  state.currentMoveIndex = 0;
  state.isWaitingForNextStep = false;
  state.isWaitingForCall = false;

  nextCardId = 1;

  // 5. Recompute the cards state by applying all moves before the target step instantly
  for (let t = 0; t <= turnIndex; t++) {
    const turn = simulationData.turns[t];
    const maxSteps = (t === turnIndex) ? stepIndex : turn.steps.length;
    for (let s = 0; s < maxSteps; s++) {
      const step = turn.steps[s];
      step.moves.forEach(move => {
        const [cardName, from, to] = move;
        if (from === 'DRAW') {
          // Draw card instantly
          const cardId = nextCardId++;
          const el = createCardElement(cardName);
          const cardObj = { id: cardId, name: cardName, element: el, highlighted: false, isMoving: false };
          cardsLayer.appendChild(el);
          if (to === 'P1') state.p1.push(cardObj);
          else if (to === 'P2') state.p2.push(cardObj);
        } else {
          // Discard card instantly
          const hand = from === 'P1' ? state.p1 : state.p2;
          const idx = hand.findIndex(c => c.name === cardName);
          if (idx !== -1) {
            const cardObj = hand[idx];
            hand.splice(idx, 1);
            cardObj.isMoving = false;
            cardObj.highlighted = false;
            state.discard.push(cardObj);
          }
        }
      });
    }
  }

  // 6. Draw current positions with transition animation disabled
  layoutCards(false);

  // 7. Update header texts
  const currentTurn = simulationData.turns[turnIndex];
  const currentStep = currentTurn.steps[stepIndex];
  updateInfoBar(currentTurn, currentStep);
  updateStepListHighlight();
  updatePlayPauseButton();
}

// Create Card DOM Element
function createCardElement(cardName) {
  const el = document.createElement('div');
  el.className = 'card';
  el.style.backgroundImage = `url('cards-front/${cardName}.png')`;
  el.style.transition = 'none';
  return el;
}

// Update Canvas Top Bar info
function updateInfoBar(turn, step) {
  turnDisplay.textContent = `TURN ${state.currentTurnIndex + 1} - STEP ${state.currentStepIndex + 1}`;
  summaryDisplay.textContent = step.summary || '';
}

// Highlight Discarding Cards
function highlightDiscardingCards(moves) {
  moves.forEach(move => {
    const [cardName, from] = move;
    const hand = from === 'P1' ? state.p1 : state.p2;
    // Find the first matching card that isn't highlighted yet
    const card = hand.find(c => c.name === cardName && !c.highlighted);
    if (card) {
      card.highlighted = true;
    }
  });
  layoutCards(true);
}

// Show/Hide Call overlay
function showCallOverlay(text) {
  // Determine who calls
  let caller = "P1";
  if (text.startsWith("P2")) caller = "P2";
  else if (text.startsWith("P1")) caller = "P1";
  else if (state.currentStepIndex === 0 || state.currentStepIndex === 1) caller = "P1"; // Default fallbacks
  else caller = "P2";

  callOverlayTitle.textContent = `${caller} CALLS`;

  // Extract call message (e.g. remove "P1 CALLS: " from text if present)
  let cleanText = text;
  if (text.includes("CALLS:")) {
    cleanText = text.split("CALLS:")[1].trim();
  } else if (text.includes("DISCARDS GROUP:")) {
    cleanText = text.split("DISCARDS GROUP:")[1].trim();
  }

  callOverlayText.textContent = cleanText;
  callOverlay.classList.add('visible');
}

function hideCallOverlay() {
  callOverlay.classList.remove('visible');
}

// Perform Discard moves
function performDiscardMoves(moves) {
  moves.forEach(move => {
    const [cardName, from] = move;
    const hand = from === 'P1' ? state.p1 : state.p2;
    const idx = hand.findIndex(c => c.name === cardName && c.highlighted);
    if (idx !== -1) {
      const card = hand[idx];
      hand.splice(idx, 1);
      card.highlighted = false;
      card.isMoving = true;
      state.discard.push(card);
    }
  });
  layoutCards(true);
}

// Finalize Discard Moves z-indexes after transition finishes
function finalizeDiscardMoves() {
  state.discard.forEach(c => c.isMoving = false);
  layoutCards(false);
}

// Execute Draw Move
function executeDrawMove(move) {
  const [cardName, from, to] = move;

  const cardId = nextCardId++;
  const el = createCardElement(cardName);
  // Spawn at Draw Pile location (offscreen left)
  el.style.left = '-185px';
  el.style.top = '494px'; // centered with discard pile area
  el.style.transition = 'none';
  cardsLayer.appendChild(el);

  // Force browser layout pass
  el.offsetHeight;

  const cardObj = {
    id: cardId,
    name: cardName,
    element: el,
    highlighted: false,
    isMoving: true
  };

  if (to === 'P1') {
    state.p1.push(cardObj);
  } else if (to === 'P2') {
    state.p2.push(cardObj);
  }

  layoutCards(true);
}

// Finalize Draw moves z-indexes after transition finishes
function finalizeDrawMoves() {
  state.p1.forEach(c => c.isMoving = false);
  state.p2.forEach(c => c.isMoving = false);
  layoutCards(false);
}

// Core card positioning engine
function layoutCards(animate = true) {
  const speed = state.playbackSpeed;
  const drawDur = state.drawDuration / speed;
  const discDur = state.discardDuration / speed;

  const cardWidth = 165;
  const canvasWidth = 720;
  const staggerFactor = 7; // spacing is ~1/7th width

  // 1. Position Player 1 Hand
  const p1Len = state.p1.length;
  const p1S = cardWidth / staggerFactor;
  const p1W = cardWidth + (p1Len - 1) * p1S;
  const p1Start = (canvasWidth - p1W) / 2;

  state.p1.forEach((card, idx) => {
    const el = card.element;
    const isHighlighted = card.highlighted;
    const isMoving = card.isMoving;

    const left = p1Start + idx * p1S;
    const top = 150 + (28 - (isHighlighted ? 25 : 0)); // shifts up on highlight (centered vertically: (290 - 233)/2 = 28.5px)
    const zIndex = isMoving ? (1000 + idx) : (10 + idx); // lift moving card to top z-index (preserve order)

    if (animate) {
      el.style.transition = `left ${drawDur}s cubic-bezier(0.25, 0.8, 0.25, 1), top ${drawDur}s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s, box-shadow 0.3s`;
    } else {
      el.style.transition = 'none';
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.zIndex = zIndex;

    if (isHighlighted) {
      el.classList.add('highlighted');
    } else {
      el.classList.remove('highlighted');
    }

    if (isMoving) {
      el.classList.add('in-flight');
    } else {
      el.classList.remove('in-flight');
    }
  });

  // 2. Position Player 2 Hand
  const p2Len = state.p2.length;
  const p2S = cardWidth / staggerFactor;
  const p2W = cardWidth + (p2Len - 1) * p2S;
  const p2Start = (canvasWidth - p2W) / 2;

  state.p2.forEach((card, idx) => {
    const el = card.element;
    const isHighlighted = card.highlighted;
    const isMoving = card.isMoving;

    const left = p2Start + idx * p2S;
    const top = 750 + (28 - (isHighlighted ? 25 : 0)); // shifts up on highlight
    const zIndex = isMoving ? (1000 + idx) : (10 + idx);

    if (animate) {
      el.style.transition = `left ${drawDur}s cubic-bezier(0.25, 0.8, 0.25, 1), top ${drawDur}s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s, box-shadow 0.3s`;
    } else {
      el.style.transition = 'none';
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.zIndex = zIndex;

    if (isHighlighted) {
      el.classList.add('highlighted');
    } else {
      el.classList.remove('highlighted');
    }

    if (isMoving) {
      el.classList.add('in-flight');
    } else {
      el.classList.remove('in-flight');
    }
  });

  // 3. Position Discard Pile (with dynamic spacing based on pile count)
  const discLen = state.discard.length;
  let discStaggerFactor = 7;

  if (discLen >= 20) {
    discStaggerFactor = 11; // 20+ cards -> ~1/11th card width spacing
  } else if (discLen >= 12) {
    discStaggerFactor = 9;  // 12-19 cards -> ~1/9th card width spacing
  }

  const discS = cardWidth / discStaggerFactor;
  const discW = cardWidth + (discLen - 1) * discS;
  const discStart = (canvasWidth - discW) / 2;

  state.discard.forEach((card, idx) => {
    const el = card.element;
    const isMoving = card.isMoving;

    const left = discStart + idx * discS;
    const top = 440 + 38; // Centered vertically in 310px area: (310 - 233)/2 = 38.5px
    const zIndex = isMoving ? (1000 + idx) : (10 + idx);

    if (animate) {
      el.style.transition = `left ${discDur}s cubic-bezier(0.25, 0.8, 0.25, 1), top ${discDur}s cubic-bezier(0.25, 0.8, 0.25, 1), transform 0.3s, box-shadow 0.3s`;
    } else {
      el.style.transition = 'none';
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.zIndex = zIndex;

    el.classList.remove('highlighted');

    if (isMoving) {
      el.classList.add('in-flight');
    } else {
      el.classList.remove('in-flight');
    }
  });
}

// Master Step Execution Engine
function runCurrentStep() {
  if (!state.isPlaying || !simulationData) return;

  const turn = simulationData.turns[state.currentTurnIndex];
  const step = turn.steps[state.currentStepIndex];

  // 1. Update Top Info Display
  updateInfoBar(turn, step);
  updateStepListHighlight();

  const isFirstStep = (state.currentTurnIndex === 0 && state.currentStepIndex === 0 && state.currentMoveIndex === 0);
  const delay = isFirstStep ? state.initialDelay : state.stepDelay;

  state.isWaitingForNextStep = true;

  // 2. Wait stepDelay (or initialDelay) before starting step movements
  const stepStartTimer = setTimeout(() => {
    state.isWaitingForNextStep = false;
    executeStepContent(step);
  }, (delay / state.playbackSpeed) * 1000);

  activeTimeouts.push(stepStartTimer);
}

// Execute the moves/announcements inside the step
function executeStepContent(step) {
  const speed = state.playbackSpeed;

  if (step.call) {
    // DISCARD STEP
    // A. Highlight the discarding cards immediately
    highlightDiscardingCards(step.moves);

    // B. Show the Call Overlay
    showCallOverlay(step.call);
    state.isWaitingForCall = true;

    // C. Wait callDuration (3 seconds default)
    const callTimer = setTimeout(() => {
      state.isWaitingForCall = false;
      hideCallOverlay();

      // D. Animate the cards to the discard pile simultaneously
      performDiscardMoves(step.moves);

      // E. Wait for the discard transition to finish (1.5 seconds)
      const transitionTimer = setTimeout(() => {
        finalizeDiscardMoves();
        advanceStep();
      }, (state.discardDuration / speed) * 1000);

      activeTimeouts.push(transitionTimer);
    }, (state.callDuration / speed) * 1000);

    activeTimeouts.push(callTimer);

  } else {
    // DRAWING STEP
    // Draw cards one by one based on state.currentMoveIndex
    const remainingMoves = step.moves.slice(state.currentMoveIndex);
    const stagger = state.staggerDelay / speed;

    remainingMoves.forEach((move, index) => {
      const moveTimer = setTimeout(() => {
        if (!state.isPlaying) return;

        executeDrawMove(move);
        state.currentMoveIndex++;

        // If this is the last card in the step
        if (state.currentMoveIndex === step.moves.length) {
          // Wait for this last card's animation to finish
          const finalizeTimer = setTimeout(() => {
            finalizeDrawMoves();
            advanceStep();
          }, (state.drawDuration / speed) * 1000);

          activeTimeouts.push(finalizeTimer);
        }
      }, index * stagger * 1000);

      activeTimeouts.push(moveTimer);
    });
  }
}

// Move to next step or next turn
function advanceStep() {
  if (!state.isPlaying) return;

  state.currentMoveIndex = 0;
  state.currentStepIndex++;

  const currentTurn = simulationData.turns[state.currentTurnIndex];

  if (state.currentStepIndex >= currentTurn.steps.length) {
    state.currentStepIndex = 0;
    state.currentTurnIndex++;
  }

  // Check if simulation ended
  if (state.currentTurnIndex >= simulationData.turns.length) {
    state.isPlaying = false;
    state.currentTurnIndex = simulationData.turns.length - 1;

    // Set step index to last step of last turn
    const lastTurnIdx = simulationData.turns.length - 1;
    const lastTurn = simulationData.turns[lastTurnIdx];
    state.currentStepIndex = lastTurn.steps.length - 1;

    updatePlayPauseButton();
    updateStepListHighlight();
    showToast("Simulation Complete!");
    return;
  }

  // If Manual Control, pause automatically after each step
  if (!state.autoAdvance) {
    pause();
    updateStepListHighlight();
    showToast(`Step completed. Paused. Click Play to continue.`);
    return;
  }

  runCurrentStep();
}
