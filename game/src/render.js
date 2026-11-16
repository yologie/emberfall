// Emberfall — all drawing: the dark arena, the glowing lantern, embers, shades,
// particles, the HUD, and every screen (title / pause / victory / game over).
// Canvas 2D only, radial gradients and shadowBlur for the glow; no images, no fonts
// beyond the system sans-serif stack.
import {
  COLORS, FLAME_LOW_WARN, FLAME_MAX, HEIGHT, NIGHTS_TO_WIN, WIDTH,
} from './config.js';
import { clamp } from './random.js';
import { nightProgress, victoryStars } from './world.js';

// Button rects the main loop uses for clicks. Same layout the screens draw.
export function screenButtons(screen, world) {
  const cx = WIDTH / 2;
  if (screen === 'title') {
    return [{ id: 'start', x: cx - 150, y: 512, w: 300, h: 62 }];
  }
  if (screen === 'victory' || screen === 'gameover') {
    return [{ id: 'again', x: cx - 150, y: 528, w: 300, h: 62 }];
  }
  if (screen === 'paused') {
    return [
      { id: 'resume', x: cx - 150, y: 330, w: 300, h: 56 },
      { id: 'restart', x: cx - 150, y: 402, w: 300, h: 56 },
    ];
  }
  return [];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(ctx, rect, label, hover, accent) {
  ctx.save();
  ctx.shadowColor = accent;
  ctx.shadowBlur = hover ? 22 : 10;
  ctx.fillStyle = hover ? 'rgba(255, 183, 3, 0.92)' : 'rgba(255, 183, 3, 0.82)';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1a1206';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
  ctx.restore();
}

function drawBackground(ctx, world, t) {
  const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  g.addColorStop(0, COLORS.bgTop);
  g.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Faint drifting motes of dust so the void never feels flat.
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const sx = (i * 173.3 + t * (6 + (i % 5) * 2)) % (WIDTH + 40) - 20;
    const sy = (i * 97.7 + Math.sin(t * 0.3 + i) * 12) % HEIGHT;
    const a = 0.05 + (i % 4) * 0.03;
    ctx.fillStyle = `rgba(154, 163, 199, ${a})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.4 + (i % 3) * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Soft arena edge glow, teal at the corners.
  const eg = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.42, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.95);
  eg.addColorStop(0, 'rgba(46, 196, 182, 0)');
  eg.addColorStop(1, 'rgba(46, 196, 182, 0.07)');
  ctx.fillStyle = eg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawEmber(ctx, e, t) {
  const bob = Math.sin(e.pulse) * 2.5;
  const flick = 0.85 + Math.sin(e.pulse * 2.1) * 0.15;
  const fade = clamp(e.life / 3, 0.25, 1); // blinks out as it expires
  const blink = e.life < 3 ? (Math.sin(t * 14) > 0 ? 1 : 0.45) : 1;
  const r = e.r * flick;
  ctx.save();
  ctx.globalAlpha = fade * blink;
  ctx.shadowColor = COLORS.emberGlow;
  ctx.shadowBlur = 22;
  const g = ctx.createRadialGradient(e.x, e.y + bob, 0, e.x, e.y + bob, r * 2.4);
  g.addColorStop(0, COLORS.emberCore);
  g.addColorStop(0.45, COLORS.emberGlow);
  g.addColorStop(1, 'rgba(255, 107, 53, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(e.x, e.y + bob, r * 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.emberCore;
  ctx.beginPath();
  ctx.arc(e.x, e.y + bob, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShade(ctx, s, t) {
  const squash = 1 + Math.sin(s.pulse) * 0.08;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(squash, 1 / squash);
  // Dark body with a faint violet rim.
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 14;
  const g = ctx.createRadialGradient(0, 0, s.r * 0.2, 0, 0, s.r * 1.5);
  g.addColorStop(0, COLORS.shadeBody);
  g.addColorStop(0.75, '#12142a');
  g.addColorStop(1, 'rgba(18, 20, 42, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, s.r * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.shadeEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, s.r * 0.95, 0, Math.PI * 2);
  ctx.stroke();
  // Two glowing eyes that track the lantern.
  const look = Math.atan2(s.vy, s.vx);
  const ex = Math.cos(look) * 3;
  const ey = Math.sin(look) * 3;
  ctx.fillStyle = COLORS.shadeEye;
  ctx.shadowColor = COLORS.shadeEye;
  ctx.shadowBlur = 10;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(ex + side * s.r * 0.36, ey - s.r * 0.18, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayer(ctx, world, t) {
  const p = world.player;
  const flameFrac = world.flame / FLAME_MAX;
  const flick = 0.9 + Math.sin(p.flicker) * 0.08 + Math.sin(p.flicker * 2.7) * 0.05;
  const glowR = (150 + flameFrac * 130) * flick;

  ctx.save();
  // The lantern's halo of warm light.
  const g = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, glowR);
  g.addColorStop(0, 'rgba(255, 214, 90, 0.34)');
  g.addColorStop(0.4, 'rgba(255, 159, 28, 0.16)');
  g.addColorStop(1, 'rgba(255, 159, 28, 0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Dash flash ring glow.
  if (p.dashFlash > 0) {
    ctx.globalAlpha = clamp(p.dashFlash / 0.35, 0, 1) * 0.8;
    ctx.strokeStyle = COLORS.flameCore;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 46 + (0.35 - p.dashFlash) * 320, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Invulnerability blink.
  if (p.invuln > 0 && Math.sin(t * 30) > 0) ctx.globalAlpha = 0.35;

  // Little lantern body: a warm glass orb in a dark frame.
  ctx.shadowColor = COLORS.flameMid;
  ctx.shadowBlur = 26;
  const bg = ctx.createRadialGradient(p.x - 4, p.y - 5, 2, p.x, p.y, 17);
  bg.addColorStop(0, COLORS.flameCore);
  bg.addColorStop(0.6, COLORS.flameMid);
  bg.addColorStop(1, COLORS.flameEdge);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Frame cap and base.
  ctx.fillStyle = '#23264a';
  ctx.fillRect(p.x - 9, p.y - 21, 18, 6);
  ctx.fillRect(p.x - 7, p.y + 14, 14, 5);
  // Flame tongue inside the glass.
  ctx.fillStyle = 'rgba(255, 243, 176, 0.95)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y - 1, 4.5 * flick, 7 * flick, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx, world) {
  ctx.save();
  for (const p of world.particles) {
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const r of world.rings) {
    const a = clamp(r.life / r.maxLife, 0, 1);
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = COLORS.flameCore;
    ctx.lineWidth = 3.5 * a + 1;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Floating score text.
  ctx.save();
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const t of world.texts) {
    const a = clamp(t.life / t.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
}

function drawVignette(ctx) {
  const g = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.38, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.85);
  g.addColorStop(0, 'rgba(4, 6, 16, 0)');
  g.addColorStop(1, COLORS.vignette);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawFlameBar(ctx, world) {
  const frac = clamp(world.flame / FLAME_MAX, 0, 1);
  const x = WIDTH / 2 - 150;
  const y = 26;
  const w = 300;
  const h = 14;
  const low = world.flame < FLAME_LOW_WARN;
  ctx.save();
  ctx.fillStyle = 'rgba(6, 8, 20, 0.75)';
  roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 9);
  ctx.fill();
  const fg = ctx.createLinearGradient(x, 0, x + w, 0);
  fg.addColorStop(0, low ? '#ff5964' : COLORS.flameEdge);
  fg.addColorStop(1, low ? '#ffb703' : COLORS.flameCore);
  ctx.fillStyle = fg;
  if (frac > 0.01) {
    roundRect(ctx, x, y, Math.max(10, w * frac), h, 7);
    ctx.fill();
  }
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(low ? 'FLAME LOW' : 'FLAME', WIDTH / 2, y + h + 18);
  ctx.restore();
}

function drawHud(ctx, world, best) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // Score, top left.
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(world.score), 28, 48);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`BEST ${Math.max(best, world.score)}`, 28, 68);

  // Night, top right, with a progress bar for the night.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`NIGHT ${world.night} / ${NIGHTS_TO_WIN}`, WIDTH - 28, 44);
  const bw = 150;
  ctx.fillStyle = 'rgba(154, 163, 199, 0.25)';
  roundRect(ctx, WIDTH - 28 - bw, 54, bw, 6, 3);
  ctx.fill();
  ctx.fillStyle = COLORS.teal;
  roundRect(ctx, WIDTH - 28 - bw, 54, bw * nightProgress(world), 6, 3);
  ctx.fill();

  // Combo, under the score.
  if (world.combo > 1) {
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.emberCore;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`COMBO x${world.combo}`, 28, 100);
    ctx.fillStyle = 'rgba(255, 209, 102, 0.5)';
    ctx.fillRect(28, 108, 90 * clamp(world.comboTimer / 2.5, 0, 1), 4);
  }

  // Dash cooldown, bottom left.
  const cd = clamp(world.player.dashCd / 2.2, 0, 1);
  ctx.textAlign = 'left';
  ctx.fillStyle = cd <= 0 ? COLORS.teal : COLORS.textDim;
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.fillText(cd <= 0 ? 'DASH READY  [SPACE]' : 'DASH …', 28, HEIGHT - 24);
  if (cd > 0) {
    ctx.fillStyle = 'rgba(46, 196, 182, 0.45)';
    ctx.fillRect(28, HEIGHT - 16, 110 * (1 - cd), 4);
  }

  drawFlameBar(ctx, world);
  ctx.restore();
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(5, 7, 18, ${alpha})`;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawTitle(ctx, world, best, hover) {
  dim(ctx, 0.45);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.shadowColor = COLORS.flameMid;
  ctx.shadowBlur = 34;
  ctx.fillText('EMBERFALL', WIDTH / 2, 190);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 24px system-ui, sans-serif';
  ctx.fillStyle = COLORS.emberCore;
  ctx.fillText('Keep the light alive.', WIDTH / 2, 232);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('Gather embers. Outrun the shades. Survive five nights.', WIDTH / 2, 264);

  // Controls card.
  const cx = WIDTH / 2;
  ctx.fillStyle = 'rgba(10, 13, 30, 0.72)';
  roundRect(ctx, cx - 260, 300, 520, 150, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(154, 163, 199, 0.35)';
  ctx.stroke();
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  const rows = [
    ['MOVE', 'WASD  /  Arrow keys'],
    ['DASH — burst of light', 'SPACE'],
    ['PAUSE', 'P      ·      MUTE  M'],
    ['RESTART', 'R'],
  ];
  rows.forEach((r, i) => {
    const y = 330 + i * 30;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.teal;
    ctx.fillText(r[0], cx - 12, y);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.fillText(r[1], cx + 12, y);
  });

  if (best > 0) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillStyle = COLORS.emberCore;
    ctx.fillText(`BEST SCORE  ${best}`, cx, 486);
  }
  drawButton(ctx, screenButtons('title')[0], 'LIGHT THE LANTERN', hover === 'start', COLORS.flameMid);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('or press Enter', cx, 606);
  ctx.restore();
}

function drawPaused(ctx, hover) {
  dim(ctx, 0.6);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText('PAUSED', WIDTH / 2, 250);
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('The dark waits. Your flame holds.', WIDTH / 2, 286);
  const btns = screenButtons('paused');
  drawButton(ctx, btns[0], 'RESUME', hover === 'resume', COLORS.flameMid);
  drawButton(ctx, btns[1], 'RESTART', hover === 'restart', COLORS.teal);
  ctx.restore();
}

function drawStats(ctx, world, y0) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  const rows = [
    `Embers gathered   ${world.embersCollected}`,
    `Shades scattered   ${world.shadesDestroyed}`,
    `Dashes   ${world.dashesUsed}      Hits taken   ${world.hitsTaken}`,
    `Nights survived   ${world.won ? NIGHTS_TO_WIN : world.night - 1} / ${NIGHTS_TO_WIN}`,
  ];
  rows.forEach((r, i) => ctx.fillText(r, WIDTH / 2, y0 + i * 30));
  ctx.restore();
}

function drawVictory(ctx, world, best, hover) {
  dim(ctx, 0.5);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.emberCore;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = COLORS.flameMid;
  ctx.shadowBlur = 30;
  ctx.fillText('DAWN BREAKS', WIDTH / 2, 170);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 22px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('Five nights survived. The light endures.', WIDTH / 2, 210);

  // Stars.
  const stars = victoryStars(world.score);
  ctx.font = '44px system-ui, sans-serif';
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = i < stars ? COLORS.emberCore : 'rgba(154, 163, 199, 0.3)';
    ctx.fillText('★', WIDTH / 2 + (i - 1) * 62, 268);
  }

  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`SCORE  ${world.score}`, WIDTH / 2, 322);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`Best  ${Math.max(best, world.score)}`, WIDTH / 2, 348);
  drawStats(ctx, world, 388);
  drawButton(ctx, screenButtons('victory')[0], 'PLAY AGAIN', hover === 'again', COLORS.flameMid);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('or press R', WIDTH / 2, 616);
  ctx.restore();
}

function drawGameOver(ctx, world, best, hover) {
  dim(ctx, 0.55);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.danger;
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.shadowColor = COLORS.danger;
  ctx.shadowBlur = 26;
  ctx.fillText('THE LIGHT FADES', WIDTH / 2, 170);
  ctx.shadowBlur = 0;
  ctx.font = 'italic 22px system-ui, sans-serif';
  ctx.fillStyle = COLORS.text;
  ctx.fillText('The dark closes in… but embers always return.', WIDTH / 2, 210);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`SCORE  ${world.score}`, WIDTH / 2, 300);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`Best  ${Math.max(best, world.score)}   ·   Night ${world.night} / ${NIGHTS_TO_WIN}`, WIDTH / 2, 326);
  drawStats(ctx, world, 366);
  drawButton(ctx, screenButtons('gameover')[0], 'TRY AGAIN', hover === 'again', COLORS.flameMid);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText('or press R', WIDTH / 2, 616);
  ctx.restore();
}

// --- top-level render ----------------------------------------------------------

export function render(ctx, screen, world, best, hover, t) {
  ctx.save();
  // Screen shake on hits — a deterministic wobble off the clock, never Math.random,
  // so a staged screenshot frame is reproducible.
  if (world.shake > 0.2) {
    const s = world.shake;
    ctx.translate(Math.sin(t * 61) * s * 0.5, Math.cos(t * 53) * s * 0.5);
  }
  drawBackground(ctx, world, t);
  for (const e of world.embers) drawEmber(ctx, e, t);
  for (const s of world.shades) drawShade(ctx, s, t);
  drawPlayer(ctx, world, t);
  drawParticles(ctx, world);
  drawVignette(ctx);
  ctx.restore();

  if (screen === 'play' || screen === 'paused') drawHud(ctx, world, best);
  if (screen === 'title') drawTitle(ctx, world, best, hover);
  else if (screen === 'paused') drawPaused(ctx, hover);
  else if (screen === 'victory') drawVictory(ctx, world, best, hover);
  else if (screen === 'gameover') drawGameOver(ctx, world, best, hover);
}
