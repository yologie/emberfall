// Emberfall — deterministic screenshot scenes.
// Each scene plays the REAL rules forward from a fresh world for a fixed number of
// fixed steps, steered by a small autopilot (seek the nearest ember, flee or dash
// from close shades). Only the seeded RNG is used, so the same seed always stages
// the same frame. After staging, the caller sets window.__shotReady = true.
import { STEP } from './config.js';
import { emptyDirections } from './input.js';
import { mulberry32 } from './random.js';
import { createWorld, stepWorld } from './world.js';

// The autopilot: a direction object for this step.
// skill 0 = weak (short lookahead, never dashes) — used for the game-over scene.
// skill 1 = good (collects, dashes when a shade closes in).
export function autopilot(world, skill) {
  const dir = emptyDirections();
  const p = world.player;

  // Nearest ember.
  let bestEmber = null;
  let bestD = Infinity;
  for (const e of world.embers) {
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bestD) { bestD = d; bestEmber = e; }
  }
  // Nearest shade.
  let nearShade = null;
  let nearD = Infinity;
  for (const s of world.shades) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < nearD) { nearD = d; nearShade = s; }
  }

  const dangerR = skill === 1 ? 150 : 55;
  let tx = p.x;
  let ty = p.y;

  if (nearShade && nearD < dangerR) {
    // Flee: run away from the shade.
    const dx = p.x - nearShade.x;
    const dy = p.y - nearShade.y;
    const len = Math.hypot(dx, dy) || 1;
    tx = p.x + (dx / len) * 200;
    ty = p.y + (dy / len) * 200;
    // A good pilot dashes when the shade is very close and the dash is ready.
    if (skill === 1 && nearD < 110 && p.dashCd <= 0) dir.dash = true;
    // But don't flee straight into the wall: drift toward centre if near an edge.
    if (p.x < 120) tx = p.x + 160;
    if (p.x > 1160) tx = p.x - 160;
    if (p.y < 120) ty = p.y + 160;
    if (p.y > 600) ty = p.y - 160;
  } else if (bestEmber && (skill === 1 || bestD < 190)) {
    // The weak pilot only notices embers right next to it — short lookahead.
    tx = bestEmber.x;
    ty = bestEmber.y;
  } else if (skill === 0) {
    // Nothing close: the weak pilot drifts, wasting the flame.
    tx = p.x + Math.sin(world.time * 0.7) * 120;
    ty = p.y + Math.cos(world.time * 0.5) * 90;
  }

  const dx = tx - p.x;
  const dy = ty - p.y;
  const dead = 6;
  if (dx > dead) dir.right = true;
  if (dx < -dead) dir.left = true;
  if (dy > dead) dir.down = true;
  if (dy < -dead) dir.up = true;
  return dir;
}

function runSteps(world, steps, skill) {
  for (let i = 0; i < steps; i++) {
    if (world.over) break;
    stepWorld(world, autopilot(world, skill), STEP);
  }
  return world;
}

// Stage one named scene. Returns { world, screen }.
export function stageShot(name, seed) {
  const rng = mulberry32(seed);
  if (name === 'title') {
    // ~5s of attract-mode play behind the title screen.
    const world = createWorld(rng);
    runSteps(world, Math.round(5 / STEP), 1);
    return { world, screen: 'title' };
  }
  if (name === 'play') {
    // ~38s: well into night 2, mid-action with HUD, particles, shades and embers.
    // (26s lands exactly on the night-1 clear, when the field is wiped clean,
    // and 31s is still too early in night 2 for the field to fill up.)
    const world = createWorld(rng);
    runSteps(world, Math.round(38 / STEP), 1);
    return { world, screen: 'play' };
  }
  if (name === 'victory') {
    // A winning run: generous ember spawns keep the flame fed while the good
    // pilot collects and dashes. 5 nights x 25s + slack.
    const world = createWorld(rng, { generous: true });
    runSteps(world, Math.round(135 / STEP), 1);
    if (!world.won) {
      // Safety net: if the pilot somehow fell short, finish the run by
      // topping the flame up and stepping until the win lands.
      world.flame = 100;
      let guard = 0;
      while (!world.over && guard++ < 60 * 30) {
        world.flame = 100;
        stepWorld(world, autopilot(world, 1), STEP);
      }
    }
    return { world, screen: world.won ? 'victory' : 'gameover' };
  }
  if (name === 'gameover') {
    // A weak pilot that never dashes: the flame drains and the shades close in.
    const world = createWorld(rng);
    let guard = 0;
    while (!world.over && guard++ < 60 * 180) {
      stepWorld(world, autopilot(world, 0), STEP);
    }
    // If the weak pilot somehow survived, report the honest screen.
    return { world, screen: world.won ? 'victory' : 'gameover' };
  }
  // Unknown scene: fall back to the title.
  const world = createWorld(rng);
  runSteps(world, Math.round(5 / STEP), 1);
  return { world, screen: 'title' };
}
