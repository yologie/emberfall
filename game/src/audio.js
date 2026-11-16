// Emberfall — WebAudio synthesized sound effects only. No audio files, no network.
// Every sound is a small oscillator/noise burst built on first user gesture; if the
// AudioContext is blocked or unavailable, every call silently no-ops.
let ctx = null;
let muted = false;
let master = null;

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

// Must be called from a user gesture (key/click) at least once; safe to call often.
export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

function tone(freq, dur, type, vol, slideTo, delay = 0) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch { /* audio must never break the game */ }
}

function noiseBurst(dur, vol, lowpass, delay = 0) {
  if (!ctx || muted) return;
  try {
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  } catch { /* audio must never break the game */ }
}

// Pickup blip: pitch climbs with the combo, so chains sound brighter.
export function sfxPickup(combo) {
  const base = 520 + Math.min(combo, 5) * 70;
  tone(base, 0.14, 'sine', 0.35, base * 1.6);
  tone(base * 2, 0.1, 'triangle', 0.12, base * 2.4, 0.02);
}

// Dash: a soft whoosh (filtered noise sweeping down) plus a low thump.
export function sfxDash() {
  noiseBurst(0.28, 0.4, 2400);
  tone(180, 0.22, 'sine', 0.3, 60);
}

// Shade destroyed by a dash: a short crackle.
export function sfxShadePop() {
  noiseBurst(0.16, 0.3, 1800);
  tone(320, 0.12, 'square', 0.1, 90);
}

// Hit: a low thud with a dull knock.
export function sfxHit() {
  tone(110, 0.3, 'sine', 0.55, 45);
  noiseBurst(0.18, 0.35, 500);
}

// Night cleared: a bright two-note chime.
export function sfxNightClear() {
  tone(660, 0.22, 'sine', 0.32);
  tone(990, 0.34, 'sine', 0.3, null, 0.12);
}

// Low-flame warning: two soft, low pulses so the player looks at the flame bar.
export function sfxLowFlame() {
  tone(220, 0.16, 'triangle', 0.3, 180);
  tone(220, 0.16, 'triangle', 0.28, 180, 0.2);
}

// Victory: a rising arpeggio.
export function sfxVictory() {
  const notes = [523, 659, 784, 1047, 1319];
  notes.forEach((f, i) => tone(f, 0.32, 'triangle', 0.28, null, i * 0.11));
}

// Game over: a slow descending line.
export function sfxGameOver() {
  const notes = [392, 330, 262, 196];
  notes.forEach((f, i) => tone(f, 0.5, 'sine', 0.3, f * 0.94, i * 0.22));
}

// UI click on a menu button.
export function sfxClick() {
  tone(740, 0.07, 'sine', 0.2, 880);
}
