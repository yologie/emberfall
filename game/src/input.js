// Emberfall — keyboard + mouse state, and edge-triggered "just pressed" actions.
// The game reads a plain direction object each step; the screenshot autopilot builds
// the same shape, so live play and staged scenes share one control surface.
import { WIDTH, HEIGHT } from './config.js';

// Keys held down right now.
const held = new Set();
// Keys pressed since the last read (edge-triggered, consumed once).
const pressed = new Set();
// Mouse state in canvas pixels.
const mouse = { x: WIDTH / 2, y: HEIGHT / 2, clicked: false, clickX: 0, clickY: 0 };

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  Space: 'dash',
};

export function attachInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * WIDTH;
    mouse.y = ((e.clientY - r.top) / r.height) * HEIGHT;
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * WIDTH;
    mouse.y = ((e.clientY - r.top) / r.height) * HEIGHT;
    mouse.clicked = true;
    mouse.clickX = mouse.x;
    mouse.clickY = mouse.y;
  });
}

// Snapshot of the current movement intent (directions + dash held).
export function readDirections() {
  const dir = { up: false, down: false, left: false, right: false, dash: false };
  for (const code of held) {
    const name = KEYMAP[code];
    if (name) dir[name] = true;
  }
  return dir;
}

// True once for each physical press of the given code, then consumed.
export function wasPressed(code) {
  if (pressed.has(code)) {
    pressed.delete(code);
    return true;
  }
  return false;
}

// True if any of the given codes was pressed since the last check.
export function anyPressed(codes) {
  for (const c of codes) if (pressed.has(c)) {
    pressed.delete(c);
    return true;
  }
  return false;
}

// Drop every buffered press. Call on a screen transition (e.g. starting a run)
// so a key mashed on the previous screen cannot skip the next one.
export function flushPressed() {
  pressed.clear();
}

// Mouse click since the last check: {x, y} or null. Consumes the click.
export function takeClick() {
  if (!mouse.clicked) return null;
  mouse.clicked = false;
  return { x: mouse.clickX, y: mouse.clickY };
}

export function mousePos() {
  return { x: mouse.x, y: mouse.y };
}

// A blank direction object (no input) — what the autopilot starts from.
export function emptyDirections() {
  return { up: false, down: false, left: false, right: false, dash: false };
}

// Hit-test helper for on-screen buttons.
export function pointInRect(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}
