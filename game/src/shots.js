// Staged screenshot scenes for ?shot=cover|takeoff|ring|cockpit. Each
// scene places the aircraft on the real course and flies the genuine
// physics forward with a simple ring-seeking autopilot, so every frame
// is a moment a player could actually reach with the same seed.
import { PLANE, RINGS, STEP } from './config.js';
import { terrainHeight } from './world.js';
import { CAMERA_CHASE, CAMERA_COCKPIT, SCREEN_PLAY } from './render.js';

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function wrapAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

// Steer toward the next ring: bank for the bearing error, pitch for the
// height error, and hold a healthy cruise throttle.
export function autopilotInput(state) {
  const ring = RINGS[state.ringsPassed];
  if (!ring) return { pitch: 0, roll: 0, throttleDelta: 0, brake: false };
  const bearing = Math.atan2(ring.x - state.x, ring.z - state.z);
  const bearingError = wrapAngle(bearing - state.heading);
  const roll = clamp(bearingError * 1.1 - state.roll * 0.9, -1, 1);
  const heightError = ring.y - state.y;
  const pitch = clamp(heightError * 0.006 - state.pitch * 0.9, -1, 1);
  const throttleDelta = state.throttle < 0.82 ? 1 : 0;
  return { pitch, roll, throttleDelta, brake: false };
}

function flySeconds(world, seconds, inputFor) {
  const steps = Math.round(seconds / STEP);
  for (let index = 0; index < steps; index += 1) {
    world.step(STEP, inputFor(world.state, index));
    if (world.state.finished) break;
  }
}

function place(state, x, y, z, heading, speed, ringsPassed) {
  state.x = x;
  state.y = y;
  state.z = z;
  state.heading = heading;
  state.speed = speed;
  state.throttle = 0.82;
  state.pitch = 0.05;
  state.roll = 0.04;
  state.verticalSpeed = 2;
  state.airborne = true;
  state.ringsPassed = ringsPassed;
  state.score = ringsPassed * 1000;
  state.time = 42 + ringsPassed * 26;
  state.message = ringsPassed > 0 ? `Ring ${ringsPassed} of ${RINGS.length}` : 'Airborne — follow the gold ring';
  state.messageTime = 4;
}

export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name === 'takeoff') {
    flySeconds(world, 8, (current) => ({
      pitch: current.speed > PLANE.rotateSpeed ? Math.max(-1, Math.min(1, (0.17 - current.pitch) * 2.2)) : 0,
      roll: 0,
      throttleDelta: 1,
      brake: false,
    }));
    state.message = 'Rotation — dawn departure, ring 1 ahead';
    state.messageTime = 4;
    return { screen: SCREEN_PLAY, best: 0, cameraMode: CAMERA_CHASE };
  }
  if (name === 'ring') {
    place(state, 800, 250, 1960, 0.8, 62, 3);
    flySeconds(world, 1.5, autopilotInput);
    state.message = 'Ring 4 — through the mountain pass';
    state.messageTime = 4;
    return { screen: SCREEN_PLAY, best: 0, cameraMode: CAMERA_CHASE };
  }
  if (name === 'cockpit') {
    place(state, 1300, 245, 2720, 0.15, 64, 5);
    flySeconds(world, 1.2, autopilotInput);
    state.message = 'Cockpit — instruments lit, ring 6 ahead';
    state.messageTime = 4;
    return { screen: SCREEN_PLAY, best: 0, cameraMode: CAMERA_COCKPIT };
  }
  // Cover: high over the river bend with ring 2 dead ahead.
  place(state, 170, 152, 1080, 0.49, 63, 1);
  flySeconds(world, 1.2, autopilotInput);
  state.message = 'Ring 1 clear — river bend below';
  state.messageTime = 4;
  return { screen: SCREEN_PLAY, best: 0, cameraMode: CAMERA_CHASE };
}
