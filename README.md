# Emberfall

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/yologie/emberfall/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/yologie/emberfall/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Emberfall** is a top-down 2D arena survival game. You are a little lantern
spirit adrift in a dark indigo void, and your flame is your life. It drains
slowly over time and drops hard whenever a shade touches you. Gather glowing
embers to feed the flame, outrun the shades that drift toward your light, and
survive all five nights to see the dawn. Chain ember pickups into a combo
multiplier, dash through the dark in a burst of light, and chase the best
score — it is saved in your browser.

Everything is drawn in code and synthesized in code: no images, no audio
files, no network requests. The game runs fully offline.

## How to play

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move the lantern |
| Space | Dash — a burst of light that destroys nearby shades and shoves the rest away (short cooldown) |
| P | Pause |
| R | Restart (from pause, victory, or game over) |
| M | Mute / unmute |
| Enter or click | Start / play again |

- **Flame:** drains over time, faster each night. An ember restores flame and
  adds score. A shade's touch costs flame and knocks you back.
- **Combo:** pick up embers within 2.5 seconds of each other to raise the
  multiplier, up to x5. Getting hit resets it.
- **Nights:** each night lasts about 25 seconds and spawns more, faster
  shades. Clearing a night pays a bonus and the field resets.
- **Win:** survive Night 5. **Lose:** your flame reaches zero.

## Run locally

```sh
node serve.ts
```

Then open <http://localhost:8080>. Any port works with `node serve.ts --port 8901`.

Deterministic screenshots: open `http://localhost:8080/?shot=title&seed=1`
(or `play`, `victory`, `gameover`) to stage a fixed scene — the game plays its
real rules forward from a seeded start and freezes on that frame. The four
scenes are listed in `shots.json`.

A read-only debug handle, `window.__ember`, exposes the current screen,
score, flame, night, and running state for scripted playtests; the game
itself never reads it.

## File layout

```text
game/
  index.html        1280x720 canvas, loads the game module
  src/
    main.js         bootstrap, fixed-step loop, screen state machine
    config.js       all tuning constants (speeds, spawn rates, night table, colors)
    random.js       seeded RNG (mulberry32) and helpers
    input.js        keyboard + mouse state, buttons
    audio.js        WebAudio synthesized sound effects + mute
    world.js        game state, spawning, nights, rules (flame, scoring, win/lose)
    entities.js     player, shade, ember, and particle update logic
    render.js       all drawing: world, entities, particles, HUD, screens
    shots.js        deterministic screenshot scenes (autopilot plays the real rules)
main.ts             packages game/ + screenshots/ and writes dossier.json
serve.ts            tiny static server for game/ on http://localhost:8080
vendor/
  makefun-game.ts   make.fun dossier library (vendored, unchanged)
shots.json          the four screenshot scenes (?shot=title|play|victory|gameover)
```

## License

MIT — see [LICENSE](LICENSE).
