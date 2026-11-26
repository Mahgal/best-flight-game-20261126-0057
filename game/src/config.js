// Aurora Runway tuning: course layout, flight model constants and colours.
// Everything the world, renderer and shot staging share lives here so the
// numbers the HUD shows are the numbers the physics uses.

export const STEP = 1 / 60;
export const BEST_KEY = 'aurora-runway-best-v1';

export const PLANE = {
  startX: 0,
  startZ: -240,
  startHeading: 0,
  rotateSpeed: 27,
  stallSpeed: 21,
  cruiseSpeed: 58,
  maxSpeed: 96,
  maxPitch: 0.62,
  maxRoll: 1.05,
  pitchRate: 1.15,
  rollRate: 2.4,
  turnGain: 0.62,
  throttleRate: 0.55,
};

export const HOME_RUNWAY = { x: 0, z: 0, heading: 0, length: 560, width: 34 };
export const FAR_RUNWAY = { x: 1500, z: 3950, heading: 0.5, length: 560, width: 34 };

// Eight rings: a dawn course out over the river bend, along the coast,
// through the mountain pass and back down to the far runway.
export const RINGS = [
  { x: 0, y: 120, z: 650, radius: 26 },
  { x: 260, y: 150, z: 1250, radius: 26 },
  { x: 620, y: 190, z: 1750, radius: 25 },
  { x: 980, y: 250, z: 2150, radius: 25 },
  { x: 1250, y: 300, z: 2550, radius: 24 },
  { x: 1420, y: 240, z: 2950, radius: 24 },
  { x: 1500, y: 242, z: 3350, radius: 24 },
  { x: 1500, y: 192, z: 3680, radius: 24 },
];

export const WORLD = {
  waterLevel: 2,
  viewDistance: 2600,
  cloudCount: 26,
  treeCount: 240,
};

export const COLOURS = {
  skyTop: '#274b8f',
  skyMid: '#7fb2e8',
  skyLow: '#f6c98b',
  sun: '#fff3c4',
  water: '#2e7fc2',
  waterDeep: '#1d5f9e',
  sand: '#e8d29a',
  grass: '#5fae52',
  meadow: '#79c25e',
  forest: '#2f7a3d',
  rock: '#8a8f96',
  snow: '#f4f8ff',
  ringNext: '#ffd23e',
  ringSoon: '#54e0ff',
  ringDone: '#69e58a',
  hudText: '#ffffff',
  hudPanel: 'rgba(8, 18, 36, 0.82)',
  hudAccent: '#ffd23e',
  warning: '#ff5a4e',
};

export function knotsFromMetresPerSecond(speed) {
  return speed * 1.94384;
}

export function feetFromMetres(metres) {
  return metres * 3.28084;
}

export function headingDegrees(heading) {
  const degrees = (heading * 180) / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

export function formatClock(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
