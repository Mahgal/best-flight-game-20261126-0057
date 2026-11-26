[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Mahgal/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Mahgal/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Aurora Runway

An original dawn flight game built for the make.fun "Make the best
flight game" bounty. Take off from a valley strip at first light, thread
eight glowing rings over a river bend, a coastline and a mountain pass,
then put the aircraft down on the far runway. Chase and cockpit views,
lit instruments, a full HUD (altitude, airspeed, heading, vertical
speed, compass, course map) and synthesised engine sound — all static
files, no network requests, no libraries.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

- **Arrows / A D** — bank and climb/descend · **W S** — throttle
- **Mouse** — steer toward the pointer · **wheel** — trim throttle
- **C** — chase / cockpit view · **Space** — brake · **P** — pause
- **R** — restart · **M** — mute

Fly through each gold ring in order (1,000 points each), mind the stall
warning below 41 kt, and land gently on the far runway to finish.

## Build the entry

```sh
MAKEFUN_OUTPUT_DIR=/tmp/out node main.ts
```

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` into the output directory and writes `dossier.json` with
the kit's `buildDossier`. It prints `BUILD-OK`.

## Layout

- `game/index.html` — the page; `game/src/main.js` — loop and screens
- `game/src/config.js` — course, flight constants, HUD conversions
- `game/src/world.js` — terrain, flight physics, rings, landings
- `game/src/render.js` — projected 3D landscape, aircraft, cockpit, HUD
- `game/src/input.js` — keyboard and mouse flight controls
- `game/src/audio.js` — WebAudio engine, chimes and warnings
- `game/src/shots.js` — the four staged screenshot scenes
- `screenshots/` — four renders of the game itself
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
