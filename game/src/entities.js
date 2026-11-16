// Emberfall — per-entity update logic: the lantern player, drifting shades,
// glowing embers, sparks, and floating score text. Pure functions over the world
// object; they never touch the DOM, so the screenshot stager can run them headless.
import {
  ARENA_MARGIN, COLORS, DASH_COOLDOWN, DASH_KILL_RADIUS, DASH_RADIUS,
  DASH_REPEL_RADIUS, EMBER_LIFETIME, FLAME_PER_EMBER, HEIGHT, INVULN_TIME,
  PARTICLE_MAX, PLAYER_ACCEL, PLAYER_FRICTION, PLAYER_RADIUS, PLAYER_SPEED,
  SHADE_HIT_SCORE, WIDTH,
} from './config.js';
import { angle, clamp, dist, range } from './random.js';

// --- particles ---------------------------------------------------------------

export function spawnParticles(world, x, y, count, color, speed, life, size) {
  for (let i = 0; i < count; i++) {
    if (world.particles.length >= PARTICLE_MAX) return;
    const a = angle(world.rng);
    const v = range(world.rng, speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: range(world.rng, life * 0.6, life),
      maxLife: life,
      size: range(world.rng, size * 0.6, size * 1.4),
      color,
      drag: 2.4,
    });
  }
}

export function burstEmberSparks(world, x, y) {
  spawnParticles(world, x, y, 14, COLORS.emberGlow, 170, 0.55, 3.2);
  spawnParticles(world, x, y, 6, COLORS.emberCore, 90, 0.8, 2.4);
}

export function burstShadeWisps(world, x, y) {
  spawnParticles(world, x, y, 12, '#6b739e', 130, 0.7, 3.6);
  spawnParticles(world, x, y, 6, COLORS.teal, 80, 0.9, 2.6);
}

export function burstDashRing(world, x, y) {
  spawnParticles(world, x, y, 26, COLORS.flameMid, 260, 0.5, 3.0);
  spawnParticles(world, x, y, 10, COLORS.flameCore, 180, 0.7, 2.4);
  world.rings.push({ x, y, r: 8, maxR: DASH_RADIUS, life: 0.45, maxLife: 0.45 });
}

export function addFloatText(world, x, y, text, color) {
  world.texts.push({ x, y, text, color, life: 1.0, maxLife: 1.0 });
}

export function updateParticles(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.life -= dt;
    if (p.life <= 0) { world.particles.splice(i, 1); continue; }
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d;
    p.vy *= d;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = world.rings.length - 1; i >= 0; i--) {
    const r = world.rings[i];
    r.life -= dt;
    r.r += (r.maxR - r.r) * Math.min(1, dt * 14);
    if (r.life <= 0) world.rings.splice(i, 1);
  }
  for (let i = world.texts.length - 1; i >= 0; i--) {
    const t = world.texts[i];
    t.life -= dt;
    t.y -= 42 * dt;
    if (t.life <= 0) world.texts.splice(i, 1);
  }
}

// --- player ------------------------------------------------------------------

export function updatePlayer(world, dir, dt) {
  const p = world.player;
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.flicker = (p.flicker + dt * 9) % (Math.PI * 2);

  let ax = 0;
  let ay = 0;
  if (dir.left) ax -= 1;
  if (dir.right) ax += 1;
  if (dir.up) ay -= 1;
  if (dir.down) ay += 1;
  if (ax !== 0 || ay !== 0) {
    const len = Math.hypot(ax, ay);
    ax /= len;
    ay /= len;
    p.vx += ax * PLAYER_ACCEL * dt;
    p.vy += ay * PLAYER_ACCEL * dt;
    p.facing = Math.atan2(ay, ax);
  }
  // Friction, then clamp to top speed.
  const fr = Math.max(0, 1 - PLAYER_FRICTION * dt);
  p.vx *= fr;
  p.vy *= fr;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > PLAYER_SPEED) {
    p.vx = (p.vx / speed) * PLAYER_SPEED;
    p.vy = (p.vy / speed) * PLAYER_SPEED;
  }
  p.x = clamp(p.x + p.vx * dt, ARENA_MARGIN, WIDTH - ARENA_MARGIN);
  p.y = clamp(p.y + p.vy * dt, ARENA_MARGIN, HEIGHT - ARENA_MARGIN);

  // Dash: a burst of light. Destroys close shades, shoves the rest away.
  if (dir.dash && p.dashCd <= 0 && !world.over) {
    p.dashCd = DASH_COOLDOWN;
    p.dashFlash = 0.35;
    burstDashRing(world, p.x, p.y);
    world.onDash();
    let popped = 0;
    for (let i = world.shades.length - 1; i >= 0; i--) {
      const s = world.shades[i];
      const d = dist(p.x, p.y, s.x, s.y);
      if (d < DASH_KILL_RADIUS + s.r) {
        burstShadeWisps(world, s.x, s.y);
        world.shades.splice(i, 1);
        world.shadesDestroyed++;
        world.score += SHADE_HIT_SCORE;
        popped++;
      } else if (d < DASH_REPEL_RADIUS + s.r) {
        const push = 420;
        const nx = (s.x - p.x) / (d || 1);
        const ny = (s.y - p.y) / (d || 1);
        s.vx += nx * push;
        s.vy += ny * push;
      }
    }
    if (popped > 0) {
      addFloatText(world, p.x, p.y - 30, `+${popped * SHADE_HIT_SCORE}`, COLORS.teal);
      world.onShadePop(popped);
    }
  }
  p.dashFlash = Math.max(0, p.dashFlash - dt);
}

// --- shades ------------------------------------------------------------------

export function updateShades(world, dt) {
  const p = world.player;
  for (let i = world.shades.length - 1; i >= 0; i--) {
    const s = world.shades[i];
    // Drift toward the light, with a slow wobble so paths feel organic.
    const d = dist(s.x, s.y, p.x, p.y) || 1;
    const nx = (p.x - s.x) / d;
    const ny = (p.y - s.y) / d;
    s.wobble += dt * s.wobbleSpeed;
    const wx = Math.cos(s.wobble) * 0.45;
    const wy = Math.sin(s.wobble) * 0.45;
    s.vx += (nx * s.speed + wx * 22 - s.vx) * Math.min(1, dt * 2.2);
    s.vy += (ny * s.speed + wy * 22 - s.vy) * Math.min(1, dt * 2.2);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.pulse += dt * 3;
    // Shades never leave the arena; they slide along the edge instead.
    s.x = clamp(s.x, 8, WIDTH - 8);
    s.y = clamp(s.y, 8, HEIGHT - 8);
  }
}

// --- embers ------------------------------------------------------------------

export function updateEmbers(world, dt) {
  for (let i = world.embers.length - 1; i >= 0; i--) {
    const e = world.embers[i];
    e.life -= dt;
    e.pulse += dt * 4;
    if (e.life <= 0) world.embers.splice(i, 1);
  }
}

// A shade touching the lantern costs flame and knocks the player back.
// Returns true when a hit landed.
export function checkShadeHits(world) {
  const p = world.player;
  if (p.invuln > 0 || world.over) return false;
  for (let i = 0; i < world.shades.length; i++) {
    const s = world.shades[i];
    const d = dist(p.x, p.y, s.x, s.y);
    if (d < PLAYER_RADIUS + s.r - 2) {
      const nx = (p.x - s.x) / (d || 1);
      const ny = (p.y - s.y) / (d || 1);
      p.vx = nx * 340;
      p.vy = ny * 340;
      p.invuln = INVULN_TIME;
      world.onPlayerHit(s);
      return true;
    }
  }
  return false;
}

// Pick up any ember the lantern overlaps. Returns how many were collected.
export function checkEmberPickups(world) {
  const p = world.player;
  let got = 0;
  for (let i = world.embers.length - 1; i >= 0; i--) {
    const e = world.embers[i];
    if (dist(p.x, p.y, e.x, e.y) < PLAYER_RADIUS + e.r + 4) {
      world.embers.splice(i, 1);
      world.onEmber(e);
      got++;
    }
  }
  return got;
}

// How much flame one ember restores right now (generous mode feeds more).
export function emberFlameGain(world) {
  return world.generous ? FLAME_PER_EMBER + 10 : FLAME_PER_EMBER;
}

// Ember lifetime (generous mode keeps them on the field longer).
export function emberLifetime(world) {
  return world.generous ? EMBER_LIFETIME + 8 : EMBER_LIFETIME;
}
