// Emberfall — bootstrap, fixed-step game loop, and the screen state machine.
// Screens: title -> play -> paused -> victory / gameover. The loop runs a fixed
// 60 Hz simulation with an accumulator; rendering is decoupled from updates.
import {
  attachInput, anyPressed, flushPressed, mousePos, pointInRect,
  readDirections, takeClick, wasPressed,
} from './input.js';
import {
  ensureAudio, sfxClick, sfxDash, sfxGameOver, sfxHit,
  sfxLowFlame, sfxNightClear, sfxPickup, sfxShadePop, sfxVictory, toggleMute,
} from './audio.js';
import { STEP } from './config.js';
import { liveRng } from './random.js';
import { render, screenButtons } from './render.js';
import { autopilot, stageShot } from './shots.js';
import { createWorld, setHooks, stepWorld } from './world.js';

const BEST_KEY = 'emberfall-best-score';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let screen = 'title'; // title | play | paused | victory | gameover
let world = createWorld(liveRng());
let best = 0;
try {
  best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;
} catch { best = 0; }

attachInput(canvas);

// One hooks object for live play: world events become sounds.
function liveHooks() {
  return {
    onDash: () => sfxDash(),
    onHit: () => sfxHit(),
    onEmber: (combo) => sfxPickup(combo),
    onShadePop: () => sfxShadePop(),
    onNightClear: () => sfxNightClear(),
    onLowFlame: () => sfxLowFlame(),
    onWin: () => sfxVictory(),
    onLose: () => sfxGameOver(),
  };
}
setHooks(world, liveHooks());

function saveBest() {
  if (world.score > best) {
    best = world.score;
    try { localStorage.setItem(BEST_KEY, String(best)); } catch { /* storage may be blocked */ }
  }
}

function startRun() {
  ensureAudio();
  flushPressed();
  world = createWorld(liveRng());
  setHooks(world, liveHooks());
  screen = 'play';
}

function endRunIfOver() {
  if (!world.over) return;
  saveBest();
  screen = world.won ? 'victory' : 'gameover';
}

// Read-only debug handle for the verifier: it can watch score/flame/night move
// during scripted playtests. Never used by the game itself.
window.__ember = {
  get state() { return screen; },
  get score() { return world.score; },
  get flame() { return world.flame; },
  get night() { return world.night; },
  get running() { return !document.hidden; },
};

// --- screenshot scenes -------------------------------------------------------
// ?shot=title|play|victory|gameover&seed=1 stages a deterministic scene and
// freezes on it; the verifier screenshots that frame.
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
let shotMode = false;
if (shotName) {
  const seed = Number(params.get('seed') || 1) || 1;
  const staged = stageShot(shotName, seed);
  world = staged.world;
  screen = staged.screen;
  shotMode = true;
  if (world.score > best) best = world.score;
}

// --- per-frame input ---------------------------------------------------------

function handleGlobalKeys() {
  if (wasPressed('KeyM')) toggleMute();
  if (wasPressed('KeyR') && (screen === 'victory' || screen === 'gameover' || screen === 'paused')) {
    sfxClick();
    startRun();
    return;
  }
  if (wasPressed('KeyP')) {
    if (screen === 'play') screen = 'paused';
    else if (screen === 'paused') screen = 'play';
  }
}

function handleClicks() {
  const click = takeClick();
  if (!click) return;
  ensureAudio();
  for (const b of screenButtons(screen, world)) {
    if (pointInRect(click.x, click.y, b)) {
      sfxClick();
      if (b.id === 'start' || b.id === 'again') startRun();
      else if (b.id === 'resume') screen = 'play';
      else if (b.id === 'restart') startRun();
      return;
    }
  }
}

function hoverButton() {
  const m = mousePos();
  for (const b of screenButtons(screen, world)) {
    if (pointInRect(m.x, m.y, b)) return b.id;
  }
  return null;
}

// --- the loop ----------------------------------------------------------------

let last = performance.now();
let acc = 0;
let elapsed = 0; // wall-clock seconds since load, for ambient animation

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(100, now - last);
  last = now;
  acc += dtMs / 1000;
  elapsed += dtMs / 1000;

  handleGlobalKeys();
  handleClicks();

  // Enter starts from the title; Space also starts from title/victory/gameover.
  if (screen === 'title' && (anyPressed(['Enter', 'NumpadEnter']) || wasPressed('Space'))) {
    startRun();
  } else if ((screen === 'victory' || screen === 'gameover') && wasPressed('Enter')) {
    startRun();
  }

  // Simulation.
  if (!shotMode) {
    if (screen === 'play') {
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        stepWorld(world, readDirections(), STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 5) acc = 0; // drop backlog after a hitch, never spiral
      endRunIfOver();
    } else if (screen === 'title') {
      // Attract mode: the world plays itself behind the title, steered by the
      // same autopilot the screenshot scenes use — no duplicate pilot here.
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        stepWorld(world, autopilot(world, 1), STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === 5) acc = 0;
      if (world.over) {
        // The attract run ended; start a fresh silent one so the backdrop never dies.
        world = createWorld(liveRng());
        setHooks(world, {});
      }
    } else {
      acc = 0;
    }
  }

  // In shot mode the world is frozen, so freeze the clock too: the staged
  // frame must be pixel-stable across runs (background motes drift with t).
  render(ctx, screen, world, best, hoverButton(), shotMode ? 0 : elapsed);
}

requestAnimationFrame(frame);

// The screenshot scenes render once and announce readiness.
if (shotMode) {
  render(ctx, screen, world, best, null, 0);
  window.__shotReady = true;
}
