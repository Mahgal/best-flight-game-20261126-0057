// Boot and the flight loop: fixed 1/60 s simulation steps, chase and
// cockpit cameras, title/pause/complete screens, and the ?shot= staging
// that renders the four entry screenshots from the real game.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_LANDED, EVENT_RING, EVENT_STALL } from './world.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { CAMERA_CHASE, CAMERA_COCKPIT, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261126;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Private windows may refuse storage; the best then lasts this visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, scene.cameraMode);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let cameraMode = CAMERA_CHASE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stallBeepAt = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startFlight() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.ensure();
    announce('Flight started. Throttle up with W, rotate past 55 knots.');
  }

  function finishFlight() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(world.state.landed ? `Course complete. Score ${world.state.score}.` : `Crashed. Score ${world.state.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CAMERA) cameraMode = cameraMode === CAMERA_CHASE ? CAMERA_COCKPIT : CAMERA_CHASE;
    if (actions & ACTION_MUTE) announce(audio.toggleMute() ? 'Sound muted.' : 'Sound on.');
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) startFlight();
    else if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startFlight();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    const events = world.step(STEP, input.flightInput());
    input.consumeWheel();
    if (events & EVENT_RING) {
      audio.ringChime();
      announce(`Ring ${world.state.ringsPassed} clear.`);
    }
    if (events & EVENT_STALL && world.state.time - stallBeepAt > 1.2) {
      stallBeepAt = world.state.time;
      audio.stallWarning();
    }
    if (events & EVENT_CRASH) {
      audio.crashThud();
      finishFlight();
    } else if (events & EVENT_LANDED) {
      audio.landingFanfare();
      finishFlight();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.setEngine(world.state.throttle, screen === SCREEN_PLAY);
    renderer.draw(world, screen, best, cameraMode);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Aurora Runway. Press Enter or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
