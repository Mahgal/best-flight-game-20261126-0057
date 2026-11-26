// The flight world: analytic dawn terrain (river valley, coast, mountain
// pass), a light aircraft with throttle/pitch/roll physics, eight course
// rings and two runways. Pure simulation — no canvas, no DOM — so the
// screenshot staging can fly the real rules forward deterministically.
import { FAR_RUNWAY, HOME_RUNWAY, PLANE, RINGS, WORLD } from './config.js';

export const EVENT_RING = 1;
export const EVENT_CRASH = 2;
export const EVENT_LANDED = 4;
export const EVENT_STALL = 8;

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Distance from a point to a runway centreline segment, and how far along
// it the point sits (0 at the threshold, 1 at the far end).
export function runwayFrame(runway, x, z) {
  const forwardX = Math.sin(runway.heading);
  const forwardZ = Math.cos(runway.heading);
  const relX = x - runway.x;
  const relZ = z - runway.z;
  const along = relX * forwardX + relZ * forwardZ;
  const across = relX * forwardZ - relZ * forwardX;
  return { along, across, halfLength: runway.length / 2, halfWidth: runway.width / 2 };
}

export function onRunway(runway, x, z, margin = 0) {
  const frame = runwayFrame(runway, x, z);
  return Math.abs(frame.along) <= frame.halfLength + margin && Math.abs(frame.across) <= frame.halfWidth + margin;
}

// Recognisable terrain from layered analytic shapes: a river bending
// through a green valley, a coast falling to the sea in the west, and a
// mountain ridge the course threads before descending to the far field.
export function terrainHeight(x, z) {
  const hills =
    26 * Math.sin(x * 0.0016 + 1.7) * Math.cos(z * 0.0013 - 0.6) +
    14 * Math.sin(x * 0.0042 - 0.4) * Math.sin(z * 0.0036 + 2.1) +
    6 * Math.sin(x * 0.011 + z * 0.007);
  const riverCentre = 420 * Math.sin(z * 0.00055 + 0.8) - 120;
  const riverCut = -16 * Math.exp(-((x - riverCentre) ** 2) / (2 * 90 * 90));
  const coast = -34 * smoothstep(-350, -1150, x);
  const ridgeCentre = 1500 + 260 * Math.sin(z * 0.0009);
  const ridge = 135 * Math.exp(-((x - ridgeCentre) ** 2) / (2 * 700 * 700)) * smoothstep(1500, 2400, z);
  const northRise = 40 * smoothstep(2800, 4200, z);
  let height = 18 + hills + riverCut + coast + ridge + northRise;
  for (const runway of [HOME_RUNWAY, FAR_RUNWAY]) {
    const frame = runwayFrame(runway, x, z);
    const flat = smoothstep(frame.halfLength + 420, frame.halfLength + 60, Math.abs(frame.along)) *
      smoothstep(frame.halfWidth + 340, frame.halfWidth + 50, Math.abs(frame.across));
    height = height * (1 - flat) + 14 * flat;
  }
  return height;
}

export function terrainKind(x, z, height) {
  if (height <= WORLD.waterLevel) return 'water';
  if (height < 6) return 'sand';
  if (height > 205) return 'snow';
  if (height > 150) return 'rock';
  if (height > 95) return 'forest';
  const patch = Math.sin(x * 0.006 + z * 0.004) + Math.sin(z * 0.009 - x * 0.002);
  return patch > 0.55 ? 'meadow' : 'grass';
}

function makeClouds(random) {
  const clouds = [];
  for (let index = 0; index < WORLD.cloudCount; index += 1) {
    clouds.push({
      x: random.range(-1600, 2600),
      y: random.range(330, 520),
      z: random.range(-500, 4500),
      scale: random.range(60, 170),
      drift: random.range(0.6, 1.8),
    });
  }
  return clouds;
}

function makeTrees(random) {
  const trees = [];
  let guard = 0;
  while (trees.length < WORLD.treeCount && guard < WORLD.treeCount * 30) {
    guard += 1;
    const x = random.range(-900, 2400);
    const z = random.range(-400, 4300);
    const height = terrainHeight(x, z);
    if (height < 8 || height > 130) continue;
    if (onRunway(HOME_RUNWAY, x, z, 60) || onRunway(FAR_RUNWAY, x, z, 60)) continue;
    trees.push({ x, z, height, size: random.range(7, 13) });
  }
  return trees;
}

export function createWorld(random) {
  const clouds = makeClouds(random);
  const trees = makeTrees(random);
  const state = {
    x: PLANE.startX,
    y: terrainHeight(PLANE.startX, PLANE.startZ) + 2,
    z: PLANE.startZ,
    heading: PLANE.startHeading,
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    verticalSpeed: 0,
    airborne: false,
    airborneTime: 0,
    ringsPassed: 0,
    score: 0,
    time: 0,
    finished: false,
    crashed: false,
    landed: false,
    message: '',
    messageTime: 0,
    ringFlash: 0,
  };

  function reset() {
    state.x = PLANE.startX;
    state.z = PLANE.startZ;
    state.y = terrainHeight(state.x, state.z) + 2;
    state.heading = PLANE.startHeading;
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.verticalSpeed = 0;
    state.airborne = false;
    state.airborneTime = 0;
    state.ringsPassed = 0;
    state.score = 0;
    state.time = 0;
    state.finished = false;
    state.crashed = false;
    state.landed = false;
    state.message = 'Throttle up with W, rotate past 55 kt';
    state.messageTime = 5;
    state.ringFlash = 0;
  }

  function nextRing() {
    return state.ringsPassed < RINGS.length ? RINGS[state.ringsPassed] : null;
  }

  function distanceToNextRing() {
    const ring = nextRing();
    if (!ring) {
      const dx = FAR_RUNWAY.x - state.x;
      const dz = FAR_RUNWAY.z - state.z;
      return Math.hypot(dx, dz);
    }
    return Math.hypot(ring.x - state.x, ring.y - state.y, ring.z - state.z);
  }

  // One fixed step. input: { pitch, roll, throttleDelta, brake } each -1..1.
  function step(dt, input) {
    if (state.finished) return 0;
    let events = 0;
    state.time += dt;
    if (state.messageTime > 0) state.messageTime -= dt;
    if (state.ringFlash > 0) state.ringFlash -= dt;
    for (const cloud of clouds) cloud.x += cloud.drift * dt;

    state.throttle = clamp(state.throttle + input.throttleDelta * PLANE.throttleRate * dt, 0, 1);
    const thrust = state.throttle * 14;
    const drag = 0.0022 * state.speed * state.speed + (input.brake ? 5.5 : 0);
    const gravityAlong = -9.8 * Math.sin(state.pitch) * (state.airborne ? 1 : 0);
    state.speed = clamp(state.speed + (thrust - drag + gravityAlong) * dt, 0, PLANE.maxSpeed);

    state.roll = clamp(state.roll + input.roll * PLANE.rollRate * dt, -PLANE.maxRoll, PLANE.maxRoll);
    if (input.roll === 0) state.roll -= state.roll * Math.min(1, 1.8 * dt);
    state.pitch = clamp(state.pitch + input.pitch * PLANE.pitchRate * dt, -PLANE.maxPitch, PLANE.maxPitch);
    if (input.pitch === 0) state.pitch -= state.pitch * Math.min(1, 0.9 * dt);

    const ground = terrainHeight(state.x, state.z);
    if (!state.airborne) {
      state.y = ground + 2;
      state.verticalSpeed = 0;
      state.heading += input.roll * 0.25 * dt * (state.speed / PLANE.rotateSpeed);
      if (state.speed >= PLANE.rotateSpeed && state.pitch > 0.08) {
        state.airborne = true;
        state.airborneTime = 0;
        state.verticalSpeed = 2;
        state.message = 'Airborne — follow the gold ring';
        state.messageTime = 4;
      }
    } else {
      state.airborneTime += dt;
      const turnRate = (Math.tan(state.roll) * 9.8 * PLANE.turnGain) / Math.max(state.speed, 18);
      state.heading += turnRate * dt;
      const liftFactor = clamp(state.speed / PLANE.cruiseSpeed, 0, 1.25);
      const climb = Math.sin(state.pitch) * state.speed * liftFactor;
      const sink = state.speed < PLANE.stallSpeed ? (PLANE.stallSpeed - state.speed) * 0.55 : 0;
      state.verticalSpeed = climb - sink - 0.4;
      if (state.speed < PLANE.stallSpeed) events |= EVENT_STALL;
      state.y += state.verticalSpeed * dt;
    }

    state.x += Math.sin(state.heading) * state.speed * dt;
    state.z += Math.cos(state.heading) * state.speed * dt;

    const ring = nextRing();
    if (ring && state.airborne) {
      const dx = ring.x - state.x;
      const dy = ring.y - state.y;
      const dz = ring.z - state.z;
      if (Math.hypot(dx, dy, dz) < ring.radius) {
        state.ringsPassed += 1;
        state.score += 1000;
        state.ringFlash = 1.2;
        state.message = state.ringsPassed >= RINGS.length ? 'All rings clear — land on the far runway' : `Ring ${state.ringsPassed} of ${RINGS.length}`;
        state.messageTime = 3;
        events |= EVENT_RING;
      }
    }

    const groundNow = terrainHeight(state.x, state.z);
    if (state.airborne && state.airborneTime > 0.6 && state.y <= groundNow + 2 && state.verticalSpeed >= 0.5) {
      // Skimming rising ground while still climbing: ride over it
      // instead of registering a touchdown the pilot never made.
      state.y = groundNow + 2;
    } else if (state.airborne && state.airborneTime > 0.6 && state.y <= groundNow + 2) {
      state.y = groundNow + 2;
      const gentle = state.verticalSpeed > -7 && state.speed < 52 && Math.abs(state.roll) < 0.35;
      if (gentle && onRunway(FAR_RUNWAY, state.x, state.z) && state.ringsPassed >= RINGS.length) {
        state.landed = true;
        state.finished = true;
        state.score += 1500 + Math.max(0, Math.round(2400 - state.time * 8));
        state.message = 'Touchdown — course complete';
        events |= EVENT_LANDED;
      } else if (gentle && (onRunway(HOME_RUNWAY, state.x, state.z) || onRunway(FAR_RUNWAY, state.x, state.z))) {
        state.airborne = false;
        state.airborneTime = 0;
        state.pitch = 0;
        state.message = state.ringsPassed >= RINGS.length ? 'Down — roll out and stop' : 'Landed early — take off again and finish the rings';
        state.messageTime = 4;
      } else {
        state.crashed = true;
        state.finished = true;
        state.message = 'Crashed — press R to fly again';
        events |= EVENT_CRASH;
      }
    }
    if (!state.airborne && state.speed < 1 && state.ringsPassed >= RINGS.length && onRunway(FAR_RUNWAY, state.x, state.z)) {
      state.landed = true;
      state.finished = true;
      state.score += 1500;
      events |= EVENT_LANDED;
    }
    return events;
  }

  return { state, clouds, trees, reset, step, nextRing, distanceToNextRing };
}
