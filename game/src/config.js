// Emberfall — all tuning constants live here. Change a number, change the game.
// Canvas and arena
export const WIDTH = 1280;
export const HEIGHT = 720;
export const ARENA_MARGIN = 36;

// Timing
export const STEP = 1 / 60; // fixed simulation step (seconds)
export const NIGHT_LENGTH = 25; // seconds per night
export const NIGHTS_TO_WIN = 5;
export const COMBO_WINDOW = 2.5; // seconds to chain a pickup
export const COMBO_MAX = 5;

// Player (the little lantern spirit)
export const PLAYER_RADIUS = 16;
export const PLAYER_SPEED = 265; // px per second
export const PLAYER_ACCEL = 2600;
export const PLAYER_FRICTION = 5.2;
export const DASH_COOLDOWN = 2.2; // seconds
export const DASH_RADIUS = 165; // light burst radius
export const DASH_KILL_RADIUS = 120; // shades inside this are destroyed
export const DASH_REPEL_RADIUS = 230; // shades inside this are shoved away
export const INVULN_TIME = 1.1; // seconds of safety after a hit

// Flame (life)
export const FLAME_MAX = 100;
export const FLAME_START = 78;
export const FLAME_DRAIN = 1.35; // per second, base
export const FLAME_DRAIN_PER_NIGHT = 0.18; // extra drain each night
export const FLAME_PER_EMBER = 8;
export const FLAME_HIT_COST = 18;
export const FLAME_LOW_WARN = 28; // HUD pulses below this

// Embers
export const EMBER_RADIUS = 10;
export const EMBER_SCORE = 10;
export const EMBER_SPAWN_INTERVAL = 2.2; // seconds
export const EMBER_MAX_FIELD = 9;
export const EMBER_LIFETIME = 14; // seconds before it fades
export const EMBER_START_COUNT = 6;

// Shades
export const SHADE_RADIUS = 17;
export const SHADE_HIT_SCORE = 5; // points for dashing one apart
export const SHADE_SPAWN_MARGIN = 70; // spawn outside the view edge band
export const NIGHT_CLEAR_BONUS = 120; // points per night cleared

// Night table: spawn interval, shade speed, max shades alive, shade radius jitter
export const NIGHTS = [
  { spawnInterval: 2.6, shadeSpeed: 62, maxShades: 5, shadeRadius: 15 },
  { spawnInterval: 2.1, shadeSpeed: 74, maxShades: 8, shadeRadius: 16 },
  { spawnInterval: 1.7, shadeSpeed: 86, maxShades: 11, shadeRadius: 17 },
  { spawnInterval: 1.4, shadeSpeed: 98, maxShades: 14, shadeRadius: 18 },
  { spawnInterval: 1.15, shadeSpeed: 112, maxShades: 18, shadeRadius: 19 },
];

// Particles and juice
export const PARTICLE_MAX = 420;
export const SHAKE_ON_HIT = 11; // px
export const SHAKE_DECAY = 26; // px per second

// Colors
export const COLORS = {
  bgTop: '#12162e',
  bgBottom: '#070a18',
  bgEdge: '#0b0e1e',
  emberCore: '#ffd166',
  emberGlow: '#ff9f1c',
  emberOuter: '#ff6b35',
  flameCore: '#fff3b0',
  flameMid: '#ffb703',
  flameEdge: '#fb8500',
  shadeBody: '#1b1e33',
  shadeEdge: '#3a3f66',
  shadeEye: '#ff5964',
  shadeEyeDim: '#c94f5e',
  teal: '#2ec4b6',
  tealDim: '#1a7f76',
  text: '#f4ead8',
  textDim: '#9aa3c7',
  danger: '#ff5964',
  vignette: 'rgba(4, 6, 16, 0.55)',
};
