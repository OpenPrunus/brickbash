# Brickbash

[![CI](https://github.com/OpenPrunus/brickbash/actions/workflows/ci.yml/badge.svg)](https://github.com/OpenPrunus/brickbash/actions/workflows/ci.yml)

The classic breakout, in the browser, with no account, installable and playable offline: bounce the ball with the paddle and smash
every brick. Ten levels, bonuses that fall from the bricks, steel that cannot be destroyed, bombs that chain.

## Features

- **Bricks**: 1, 2 or 3 hits (colour shows what is left), **steel** (indestructible, bounce around it), **explosive** (destroys its
  neighbours, and chains with other explosives).
- **Bonuses** dropped by broken bricks: wide paddle, multiball (up to 6 balls), slow motion, glue (the ball sticks to the paddle until
  you tap), laser (tap to shoot), extra life (up to 5).
- **Where the ball meets the paddle decides the angle**; the ball speeds up a little with every return and never gets stuck on a
  horizontal path. Combo multiplier for chained hits.
- **Ten levels** of growing speed, scores and 1–3 stars (no life lost = 3 stars) kept in the browser; levels unlock one after the other.
- **Mouse** (the paddle follows the pointer, click to launch), **touch** (slide a finger anywhere to move the paddle, tap to launch or
  shoot) and **keyboard** (arrows / A D, Space to launch, P pause, R restart, Esc leave). The field is portrait and fits any screen —
  on a phone held sideways the controls move next to it.
- French and English, synthesized sounds, **installable and playable offline** (PWA: manifest, icons, network-first service worker).

## Run it

```bash
docker compose up -d --build     # http://localhost:8100
# or, without Docker, any static server on web/:
npm run serve                    # python3 -m http.server 8100 --directory web
```

It is a static site: `web/` is the whole game (HTML, CSS and JavaScript modules, no build step, no dependency).

## How it works

```
web/js/engine.js   the simulation: ball physics (sub-stepped, so it never tunnels through a brick), bricks, bonuses, lasers, lives.
                   60 steps per second, seeded random generator (only the bonus drops are random): a game can be replayed
web/js/levels.js   the levels, as 12-column text maps
web/js/render.js   the drawing (canvas at 2x for sharp edges, sparks, ball trail)
web/js/main.js     screens, game loop, mouse / touch / keyboard, progress
```

## Tests

```bash
npm run test:unit      # engine rules, translations, PWA files, and an autoplayer that must clear every level
npm run test:browser   # real headless Chrome driven over DevTools: menus, mouse, touch, phone layouts, offline
npm run lint
```

## License

MIT
