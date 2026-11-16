// Emberfall — game state, spawning, nights, and the rules that decide win/lose.
// Owns the flame drain, the combo, the score, and night progression. The update
// step is pure over the world object (plus the injected hooks for sound), so the
// screenshot stager can play whole runs forward deterministically.
import {
  COMBO_MAX, COMBO_WINDOW, EMBER_LIFETIME, EMBER_MAX_FIELD,
  EMBER_RADIUS, EMBER_SCORE, EMBER_SPAWN_INTERVAL, EMBER_START_COUNT,
  FLAME_DRAIN, FLAME_DRAIN_PER_NIGHT, FLAME_HIT_COST, FLAME_LOW_WARN, FLAME_MAX,
  FLAME_START, HEIGHT, NIGHT_CLEAR_BONUS, NIGHT_LENGTH, NIGHTS,
  NIGHTS_TO_WIN, SHADE_RADIUS, SHADE_SPAWN_MARGIN, WIDTH,
} from './config.js';
import { clamp, intRange, range } from './random.js';
import {
  addFloatText, burstEmberSparks, burstShadeWisps, checkEmberPickups,
  checkShadeHits, emberFlameGain, emberLifetime, updateEmbers,
  updateParticles, updatePlayer, updateShades,
} from './entities.js';

const NO_HOOKS = {
  onDash: () => {},
  onHit: () => {},
  onEmber: () => {},
  onShadePop: () => {},
  onNightClear: () => {},
  onLowFlame: () => {},
  onWin: () => {},
  onLose: () => {},
};

// A fresh world. rng is any () => [0,1) function. opts.generous makes the run
// easier (used only by the victory screenshot staging, never in live play).
export function createWorld(rng, opts = {}) {
  const world = {
    rng,
    generous: !!opts.generous,
    time: 0,
    night: 1,
    nightTime: 0,
    score: 0,
    best: 0,
    embersCollected: 0,
    shadesDestroyed: 0,
    dashesUsed: 0,
    hitsTaken: 0,
    combo: 0,
    comboTimer: 0,
    flame: FLAME_START,
    lowWarned: false,
    shake: 0,
    over: false,
    won: false,
    spawnTimer: 1.2,
    emberTimer: 0.4,
    player: {
      x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0,
      r: 16, dashCd: 0, dashFlash: 0, invuln: 0, flicker: 0, facing: -Math.PI / 2,
    },
    shades: [],
    embers: [],
    particles: [],
    rings: [],
    texts: [],
    hooks: NO_HOOKS,
    // Event handlers the world calls back into (sound + scoring live here).
    onDash() { this.dashesUsed++; this.hooks.onDash(); },
    onShadePop(n) { this.hooks.onShadePop(n); },
    onPlayerHit(shade) {
      this.hitsTaken++;
      this.flame = Math.max(0, this.flame - FLAME_HIT_COST);
      this.combo = 0;
      this.comboTimer = 0;
      this.shake = 11;
      burstShadeWisps(this, this.player.x, this.player.y);
      this.hooks.onHit();
    },
    onEmber(ember) {
      this.embersCollected++;
      if (this.comboTimer > 0) this.combo = Math.min(COMBO_MAX, this.combo + 1);
      else this.combo = 1;
      this.comboTimer = COMBO_WINDOW;
      const gain = this.combo * EMBER_SCORE;
      this.score += gain;
      this.flame = Math.min(FLAME_MAX, this.flame + emberFlameGain(this));
      burstEmberSparks(this, ember.x, ember.y);
      addFloatText(this, ember.x, ember.y - 14, `+${gain}`, '#ffd166');
      this.hooks.onEmber(this.combo);
    },
  };

  // Opening scatter of embers so the first seconds already sparkle.
  for (let i = 0; i < EMBER_START_COUNT; i++) spawnEmber(world, true);
  return world;
}

export function setHooks(world, hooks) {
  world.hooks = { ...NO_HOOKS, ...hooks };
}

// --- spawning ----------------------------------------------------------------

export function spawnEmber(world, anywhere = false) {
  if (world.embers.length >= EMBER_MAX_FIELD) return;
  const p = world.player;
  let x;
  let y;
  for (let tries = 0; tries < 12; tries++) {
    x = range(world.rng, 60, WIDTH - 60);
    y = range(world.rng, 60, HEIGHT - 60);
    // Don't drop an ember on top of the lantern unless it's the opening scatter.
    if (anywhere || Math.hypot(x - p.x, y - p.y) > 130) break;
  }
  world.embers.push({
    x, y, r: EMBER_RADIUS,
    life: emberLifetime(world),
    maxLife: emberLifetime(world),
    pulse: range(world.rng, 0, Math.PI * 2),
    drift: range(world.rng, 0, Math.PI * 2),
  });
}

export function spawnShade(world) {
  const night = NIGHTS[world.night - 1];
  const p = world.player;
  // Spawn just outside the arena edge band, on the side farthest from the player
  // half the time so shades arrive from all directions.
  const side = intRange(world.rng, 0, 3);
  let x;
  let y;
  if (side === 0) { x = range(world.rng, 0, WIDTH); y = -SHADE_SPAWN_MARGIN; }
  else if (side === 1) { x = WIDTH + SHADE_SPAWN_MARGIN; y = range(world.rng, 0, HEIGHT); }
  else if (side === 2) { x = range(world.rng, 0, WIDTH); y = HEIGHT + SHADE_SPAWN_MARGIN; }
  else { x = -SHADE_SPAWN_MARGIN; y = range(world.rng, 0, HEIGHT); }
  // Never spawn right on the lantern.
  if (Math.hypot(x - p.x, y - p.y) < 220) {
    x = (x + WIDTH / 2) % (WIDTH + 2 * SHADE_SPAWN_MARGIN) - SHADE_SPAWN_MARGIN;
    y = (y + HEIGHT / 2) % (HEIGHT + 2 * SHADE_SPAWN_MARGIN) - SHADE_SPAWN_MARGIN;
  }
  world.shades.push({
    x, y, vx: 0, vy: 0,
    r: night.shadeRadius + range(world.rng, -2, 2),
    speed: night.shadeSpeed * range(world.rng, 0.85, 1.2),
    wobble: range(world.rng, 0, Math.PI * 2),
    wobbleSpeed: range(world.rng, 0.7, 1.6),
    pulse: range(world.rng, 0, Math.PI * 2),
    eyes: range(world.rng, 0, Math.PI * 2),
  });
}

// --- the step ----------------------------------------------------------------

// Advance the world one fixed step. dir is {up,down,left,right,dash}.
// Returns nothing; read world.over / world.won afterwards.
export function stepWorld(world, dir, dt) {
  if (world.over) {
    updateParticles(world, dt);
    return;
  }
  world.time += dt;
  world.nightTime += dt;

  // Flame drains steadily; later nights burn a little faster.
  const drain = (FLAME_DRAIN + (world.night - 1) * FLAME_DRAIN_PER_NIGHT)
    * (world.generous ? 0.55 : 1);
  world.flame = Math.max(0, world.flame - drain * dt);

  // Low-flame warning, once per dip below the line.
  if (world.flame < FLAME_LOW_WARN && !world.lowWarned) {
    world.lowWarned = true;
    world.hooks.onLowFlame();
  } else if (world.flame > FLAME_LOW_WARN + 8) {
    world.lowWarned = false;
  }

  // Combo decays.
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // Screen shake decays.
  world.shake = Math.max(0, world.shake - 26 * dt);

  updatePlayer(world, dir, dt);
  updateShades(world, dt);
  updateEmbers(world, dt);
  updateParticles(world, dt);

  // Ember spawner.
  world.emberTimer -= dt;
  if (world.emberTimer <= 0) {
    world.emberTimer = EMBER_SPAWN_INTERVAL * (world.generous ? 0.55 : 1);
    spawnEmber(world);
  }

  // Shade spawner, capped per night.
  const night = NIGHTS[world.night - 1];
  world.spawnTimer -= dt;
  if (world.spawnTimer <= 0 && world.shades.length < night.maxShades) {
    world.spawnTimer = night.spawnInterval * range(world.rng, 0.8, 1.25);
    spawnShade(world);
  }

  checkEmberPickups(world);
  checkShadeHits(world);

  // Night ends: bonus, clear the field of shades, next night begins.
  if (world.nightTime >= NIGHT_LENGTH) {
    const bonus = NIGHT_CLEAR_BONUS * world.night;
    world.score += bonus;
    addFloatText(world, world.player.x, world.player.y - 44,
      `Night ${world.night} clear  +${bonus}`, '#2ec4b6');
    for (const s of world.shades) burstShadeWisps(world, s.x, s.y);
    world.shades.length = 0;
    world.hooks.onNightClear(world.night);
    if (world.night >= NIGHTS_TO_WIN) {
      world.won = true;
      world.over = true;
      world.hooks.onWin();
    } else {
      world.night++;
      world.nightTime = 0;
      // A small breather: a fresh ember near the lantern.
      spawnEmber(world, true);
    }
  }

  // The flame went out.
  if (world.flame <= 0 && !world.over) {
    world.over = true;
    world.won = false;
    world.hooks.onLose();
  }
}

// Stars for the victory screen: 1 for surviving, +1 past 1800, +1 past 3000.
// A clean winning run scores around 3000–3500, so three stars means a good run.
export function victoryStars(score) {
  if (score >= 3000) return 3;
  if (score >= 1800) return 2;
  return 1;
}

// How far through the current night we are, 0..1 (for the HUD night bar).
export function nightProgress(world) {
  return clamp(world.nightTime / NIGHT_LENGTH, 0, 1);
}
