# best-flight-game-20261126-0057 — BUILD.md

Entry: Mahgal/best-flight-game-20261126-0057, game "Aurora Runway".
Competition: best-flight-game-20261126-0057 "Make the best flight game",
$500, opens 2026-11-26T00:57Z, deadline 2026-11-28T00:57Z.
Kit downloaded 2026-11-26 from https://make.fun/c/best-flight-game-20261126-0057/kit
(gzip, 8.1 MB); RULES.txt + competition.yaml + starter read before building.

## Design (written from scratch this session)

- Original game: dawn takeoff from a valley strip, eight glowing rings
  over a river bend, coastline and mountain pass, landing on the far
  runway. Canvas 2D projected 3D (no libraries, no network, no assets).
- Views: chase (aircraft in frame, banking, nav lights, ground shadow)
  and cockpit (C key) with six lit gauges (speed, altitude, attitude,
  heading, vertical speed) plus yoke.
- HUD: altitude ft AGL, airspeed kt, heading, vertical speed, compass
  strip, rings/time/score, throttle bar, course minimap, next-ring
  guide line/arrow with distance, stall warning.
- Flight model: throttle/pitch/roll physics, stall sink, ground roll
  and rotation, gentle-touchdown landing check, crash on hard arrival.
  Keyboard (arrows/A/D/W/S/Space/C/P/R/M) and mouse (steer + wheel).
- Sound: WebAudio synthesis only (engine hum, ring chime, stall beep,
  crash thud, landing arpeggio).
- Screenshots: four staged scenes (?shot=cover|takeoff|ring|cockpit)
  flown forward with the real physics, captured in headless Chromium
  at 1280x720 and visually inspected over three iteration rounds.

## Evidence

- Determinism: `MAKEFUN_OUTPUT_DIR` runs of main.ts twice produced
  byte-identical trees (diff -r clean); dossier.json sha256
  30ea860ec0dc89649826f39d51a80c28d7fdf8be1f24469a802dc4403c44ddd6 both runs.
- Kit check (no transcripts): 4 passed, 1 failed, 15 skipped,
  5 at submission. The only FAIL is transcripts_present, which the
  main agent clears by bundling. competition_open, snapshot,
  license_osi and entrypoint all pass.
- vendor/makefun-game.ts sha256
  dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129,
  identical to the kit starter copy.
- Playability: headless Chromium, zero page errors (only the favicon
  404 before an inline data: icon was added). Scripted keys Enter+W+
  ArrowUp reached airborne flight (217 ft AGL, 105 kt). Node physics
  simulation: scripted pilot cleared all 8 rings; a stabilised final
  approach landed (score 11,686, "Touchdown — course complete").
- Bugs found and fixed during verification: liftoff re-touchdown loop
  (touchdown now gated on airborne time + climb skim), rings 7-8
  raised for terrain clearance (70-158 m at every ring), runway drawn
  in segments so near corners behind the camera no longer hide it,
  HUD unit overlap, distant-ring clutter.

## Repository

- Local commit on main, author Mahgal <imahgal@gmail.com>.
- GitHub push attempted once 2026-11-26: failed ("Host key
  verification failed"; gh CLI is not logged in on this VM and the
  repository does not exist yet). Per instructions, not retried.
- For the main agent to create: public repo
  Mahgal/best-flight-game-20261126-0057, homepage
  https://make.fun/bounty/best-flight-game-20261126-0057, topics
  makefun, ai-agents, bounties, games. Then push main and bundle +
  submit (wallet 24iPJy4Dr4SKc47nzw5Mnhknrv7FgpUWFXJKWJP58jhQ is in
  .makefun/owner.json; no Solana key was generated or used).
