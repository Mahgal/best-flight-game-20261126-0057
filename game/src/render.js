// Canvas rendering for Aurora Runway: a projected 3D dawn landscape
// (river valley, coast, mountain pass), a chase view with a built-looking
// aircraft, a lit cockpit view, and a flight HUD whose altitude, speed
// and heading readouts stay legible at thumbnail size.
import { COLOURS, FAR_RUNWAY, HOME_RUNWAY, RINGS, WORLD, feetFromMetres, formatClock, headingDegrees, knotsFromMetresPerSecond } from './config.js';
import { onRunway, runwayFrame, terrainHeight, terrainKind } from './world.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const CAMERA_CHASE = 0;
export const CAMERA_COCKPIT = 1;

const TERRAIN_FILL = {
  water: '#2e7fc2',
  sand: '#e8d29a',
  grass: '#5fae52',
  meadow: '#7cc45f',
  forest: '#2f7a3d',
  rock: '#8a8f96',
  snow: '#f4f8ff',
};

function clamp(value, low, high) {
  return value < low ? low : value > high ? high : value;
}

function mixColour(colourA, colourB, amount) {
  const parse = (colour) => {
    if (colour.startsWith('#')) return [parseInt(colour.slice(1, 3), 16), parseInt(colour.slice(3, 5), 16), parseInt(colour.slice(5, 7), 16)];
    const parts = colour.match(/\d+/g).map(Number);
    return [parts[0], parts[1], parts[2]];
  };
  const a = parse(colourA);
  const b = parse(colourB);
  const mixed = a.map((channel, index) => Math.round(channel + (b[index] - channel) * clamp(amount, 0, 1)));
  return `rgb(${mixed[0]},${mixed[1]},${mixed[2]})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 1280;
  let height = 720;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // Camera basis for the current frame, rebuilt by buildCamera each draw.
  const camera = { x: 0, y: 0, z: 0, fx: 0, fy: 0, fz: 1, rx: 1, rz: 0, ux: 0, uy: 1, uz: 0, focal: 600, roll: 0 };

  function buildCamera(state, cameraMode) {
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);
    const camPitch = state.pitch * 0.55 - 0.05;
    const sinP = Math.sin(camPitch);
    const cosP = Math.cos(camPitch);
    camera.fx = sinH * cosP;
    camera.fy = sinP;
    camera.fz = cosH * cosP;
    camera.rx = cosH;
    camera.rz = -sinH;
    camera.ux = -sinH * sinP;
    camera.uy = cosP;
    camera.uz = -cosH * sinP;
    camera.focal = (height / 2) / Math.tan((62 * Math.PI) / 360);
    camera.roll = state.roll * (cameraMode === CAMERA_COCKPIT ? 0.9 : 0.55);
    if (cameraMode === CAMERA_COCKPIT) {
      camera.x = state.x + sinH * 1.2;
      camera.y = state.y + 1.6;
      camera.z = state.z + cosH * 1.2;
    } else {
      const back = state.airborne ? 20 : 17;
      camera.x = state.x - sinH * back;
      camera.y = state.y + 5.4 - state.pitch * 3;
      camera.z = state.z - cosH * back;
      const floor = terrainHeight(camera.x, camera.z) + 2.2;
      if (camera.y < floor) camera.y = floor;
    }
  }

  function project(wx, wy, wz) {
    const dx = wx - camera.x;
    const dy = wy - camera.y;
    const dz = wz - camera.z;
    const forward = dx * camera.fx + dy * camera.fy + dz * camera.fz;
    if (forward < 4) return null;
    const right = dx * camera.rx + dz * camera.rz;
    const up = dx * camera.ux + dy * camera.uy + dz * camera.uz;
    let sx = (right / forward) * camera.focal;
    let sy = -(up / forward) * camera.focal;
    const cosR = Math.cos(camera.roll);
    const sinR = Math.sin(camera.roll);
    const rotatedX = sx * cosR - sy * sinR;
    const rotatedY = sx * sinR + sy * cosR;
    return { x: width / 2 + rotatedX, y: height / 2 + rotatedY, forward, scale: camera.focal / forward };
  }

  function drawSky(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, COLOURS.skyTop);
    gradient.addColorStop(0.45, COLOURS.skyMid);
    gradient.addColorStop(0.72, COLOURS.skyLow);
    gradient.addColorStop(1, '#e8a56b');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    const sun = project(state.x + 1400, 260, state.z + 5200);
    if (sun) {
      const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 190);
      glow.addColorStop(0, 'rgba(255,243,196,0.95)');
      glow.addColorStop(0.25, 'rgba(255,214,140,0.55)');
      glow.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sun.x - 190, sun.y - 190, 380, 380);
      ctx.fillStyle = COLOURS.sun;
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTerrain(state) {
    const rows = [];
    let distance = 7;
    while (distance < WORLD.viewDistance) {
      rows.push(distance);
      distance *= 1.13;
    }
    rows.push(WORLD.viewDistance);
    const cols = 33;
    const sinH = Math.sin(state.heading);
    const cosH = Math.cos(state.heading);
    const grid = [];
    for (let r = 0; r < rows.length; r += 1) {
      const row = [];
      const dist = rows[r];
      for (let c = 0; c < cols; c += 1) {
        const lateral = ((c / (cols - 1)) * 2 - 1) * Math.max(dist * 1.05, 80);
        const wx = camera.x + sinH * dist + cosH * lateral;
        const wz = camera.z + cosH * dist - sinH * lateral;
        const wy = terrainHeight(wx, wz);
        row.push({ wx, wy, wz, point: project(wx, wy, wz) });
      }
      grid.push(row);
    }
    for (let r = grid.length - 2; r >= 0; r -= 1) {
      for (let c = 0; c < cols - 1; c += 1) {
        const a = grid[r][c];
        const b = grid[r][c + 1];
        const d = grid[r + 1][c + 1];
        const e = grid[r + 1][c];
        if (!a.point || !b.point || !d.point || !e.point) continue;
        const avgHeight = (a.wy + b.wy + d.wy + e.wy) / 4;
        const kind = terrainKind((a.wx + d.wx) / 2, (a.wz + d.wz) / 2, avgHeight);
        const slope = clamp((d.wy - a.wy) / Math.max(1, rows[r + 1] - rows[r]) + 0.5, 0, 1);
        let fill = TERRAIN_FILL[kind];
        if (kind === 'water') fill = avgHeight < -4 ? COLOURS.waterDeep : COLOURS.water;
        fill = mixColour(fill, slope > 0.5 ? '#ffffff' : '#1d3320', Math.abs(slope - 0.5) * 0.5);
        const haze = clamp((rows[r] - 700) / 1900, 0, 0.55);
        fill = mixColour(fill, '#cfe0f2', haze);
        const grain = Math.sin(a.wx * 0.37 + a.wz * 0.53) * 0.5 + Math.sin(a.wz * 0.91) * 0.5;
        fill = mixColour(fill, grain > 0 ? '#ffffff' : '#14351c', Math.abs(grain) * 0.07);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(a.point.x, a.point.y);
        ctx.lineTo(b.point.x, b.point.y);
        ctx.lineTo(d.point.x, d.point.y);
        ctx.lineTo(e.point.x, e.point.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function drawRunway(runway) {
    const segments = 14;
    const sinH = Math.sin(runway.heading);
    const cosH = Math.cos(runway.heading);
    const cornerAt = (along, across) => {
      const wx = runway.x + sinH * along + cosH * across;
      const wz = runway.z + cosH * along - sinH * across;
      return project(wx, terrainHeight(wx, wz) + 0.4, wz);
    };
    for (let index = 0; index < segments; index += 1) {
      const a0 = -runway.length / 2 + (runway.length / segments) * index;
      const a1 = -runway.length / 2 + (runway.length / segments) * (index + 1);
      const corners = [cornerAt(a0, -runway.width / 2), cornerAt(a0, runway.width / 2), cornerAt(a1, runway.width / 2), cornerAt(a1, -runway.width / 2)];
      if (corners.some((corner) => !corner)) continue;
      ctx.fillStyle = '#3c4148';
      ctx.beginPath();
      corners.forEach((corner, cornerIndex) => (cornerIndex === 0 ? ctx.moveTo(corner.x, corner.y) : ctx.lineTo(corner.x, corner.y)));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (index % 2 === 0) {
        const dashA = cornerAt(a0 + 4, 0);
        const dashB = cornerAt(a0 + (runway.length / segments) * 0.55, 0);
        if (dashA && dashB) {
          ctx.strokeStyle = '#ffd23e';
          ctx.lineWidth = Math.max(1.5, dashA.scale * 0.35);
          ctx.beginPath();
          ctx.moveTo(dashA.x, dashA.y);
          ctx.lineTo(dashB.x, dashB.y);
          ctx.stroke();
        }
      }
    }
    for (let stepIndex = -5; stepIndex <= 5; stepIndex += 1) {
      for (const side of [-1, 1]) {
        const wx = runway.x + sinH * stepIndex * 48 + cosH * side * (runway.width / 2 + 2);
        const wz = runway.z + cosH * stepIndex * 48 - sinH * side * (runway.width / 2 + 2);
        const light = project(wx, terrainHeight(wx, wz) + 1, wz);
        if (!light) continue;
        ctx.fillStyle = '#ffe9a3';
        ctx.beginPath();
        ctx.arc(light.x, light.y, Math.max(1.5, 0.5 * light.scale), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawTrees(trees) {
    for (const tree of trees) {
      const point = project(tree.x, tree.height, tree.z);
      if (!point || point.forward > 1000) continue;
      const size = tree.size * point.scale;
      if (size < 2) continue;
      ctx.fillStyle = '#5a3d24';
      ctx.fillRect(point.x - size * 0.06, point.y - size * 0.3, size * 0.12, size * 0.3);
      ctx.fillStyle = '#1f6b31';
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - size);
      ctx.lineTo(point.x - size * 0.42, point.y - size * 0.25);
      ctx.lineTo(point.x + size * 0.42, point.y - size * 0.25);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawClouds(clouds) {
    for (const cloud of clouds) {
      const point = project(cloud.x, cloud.y, cloud.z);
      if (!point) continue;
      const size = cloud.scale * point.scale;
      if (size < 6 || size > width) continue;
      ctx.fillStyle = 'rgba(255,252,248,0.82)';
      for (const [offsetX, offsetY, radius] of [[-0.5, 0.08, 0.42], [0, -0.1, 0.55], [0.5, 0.08, 0.4], [0.15, 0.16, 0.48]]) {
        ctx.beginPath();
        ctx.ellipse(point.x + offsetX * size, point.y + offsetY * size, radius * size, radius * size * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawRings(state) {
    RINGS.forEach((ring, index) => {
      const point = project(ring.x, ring.y, ring.z);
      if (!point) return;
      const radiusPx = ring.radius * point.scale;
      if (radiusPx < 3 || point.forward > 2200) return;
      if (index > state.ringsPassed && point.forward > 1200) return;
      const isNext = index === state.ringsPassed;
      const isDone = index < state.ringsPassed;
      const colour = isDone ? COLOURS.ringDone : isNext ? COLOURS.ringNext : COLOURS.ringSoon;
      const pulse = isNext ? 1 + Math.sin(state.time * 4) * 0.06 : 1;
      ctx.save();
      ctx.globalAlpha = isDone ? 0.35 : 0.95;
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(2, radiusPx * 0.12);
      ctx.shadowColor = colour;
      ctx.shadowBlur = isNext ? 18 : 6;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radiusPx * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = Math.max(1.5, radiusPx * 0.05);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radiusPx * 0.82 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      if (radiusPx > 22) {
        ctx.fillStyle = colour;
        ctx.font = `700 ${Math.max(12, radiusPx * 0.3)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(String(index + 1), point.x, point.y - radiusPx * 1.12);
      }
      ctx.restore();
    });
  }

  function drawPlaneShadow(state) {
    const ground = terrainHeight(state.x, state.z);
    const point = project(state.x, ground + 0.5, state.z);
    if (!point) return;
    const heightAbove = clamp(state.y - ground, 0, 220);
    const size = clamp((6 + heightAbove * 0.03) * point.scale, 8, 85);
    ctx.fillStyle = `rgba(10,20,10,${clamp(0.4 - heightAbove * 0.0012, 0.06, 0.4)})`;
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, size, size * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawAircraft(state) {
    const point = project(state.x, state.y, state.z);
    if (!point) return;
    const size = 8.2 * point.scale;
    const blink = Math.sin(state.time * 6) > 0;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(state.roll * 0.7);
    ctx.scale(1, 1 - Math.abs(state.pitch) * 0.18);
    // Wings with dawn-orange tips.
    const wing = ctx.createLinearGradient(-size / 2, 0, size / 2, 0);
    wing.addColorStop(0, '#e8641e');
    wing.addColorStop(0.18, '#f4f6f8');
    wing.addColorStop(0.5, '#dfe6ec');
    wing.addColorStop(0.82, '#f4f6f8');
    wing.addColorStop(1, '#e8641e');
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.moveTo(-size / 2, size * 0.1);
    ctx.lineTo(-size * 0.1, -size * 0.02);
    ctx.lineTo(size * 0.1, -size * 0.02);
    ctx.lineTo(size / 2, size * 0.1);
    ctx.lineTo(size * 0.43, size * 0.17);
    ctx.lineTo(-size * 0.43, size * 0.17);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,30,45,0.55)';
    ctx.lineWidth = Math.max(1, size * 0.012);
    ctx.stroke();
    // Tailplane and fin.
    ctx.fillStyle = '#e8641e';
    ctx.beginPath();
    ctx.moveTo(-size * 0.19, size * 0.22);
    ctx.lineTo(size * 0.19, size * 0.22);
    ctx.lineTo(size * 0.13, size * 0.29);
    ctx.lineTo(-size * 0.13, size * 0.29);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.03, size * 0.02);
    ctx.lineTo(size * 0.03, size * 0.02);
    ctx.lineTo(size * 0.045, -size * 0.16);
    ctx.lineTo(-size * 0.045, -size * 0.16);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    const body = ctx.createLinearGradient(0, -size * 0.3, 0, size * 0.4);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.55, '#cfd9e2');
    body.addColorStop(1, '#8fa3b5');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, size * 0.03, size * 0.115, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Canopy with a dawn glint.
    const canopy = ctx.createLinearGradient(-size * 0.06, -size * 0.18, size * 0.06, size * 0.05);
    canopy.addColorStop(0, '#bfe9ff');
    canopy.addColorStop(0.5, '#2d6fa8');
    canopy.addColorStop(1, '#173d5f');
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.05, size * 0.06, size * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(-size * 0.025, -size * 0.1, size * 0.018, size * 0.04, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Propeller disc.
    ctx.fillStyle = 'rgba(30,40,55,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, -size * 0.21, size * 0.27, size * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22303f';
    ctx.beginPath();
    ctx.arc(0, -size * 0.21, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights.
    ctx.fillStyle = blink ? '#ff3b30' : '#7a1d18';
    ctx.beginPath();
    ctx.arc(-size / 2 + 3, size * 0.11, Math.max(2, size * 0.02), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#2ee66b' : '#145c2b';
    ctx.beginPath();
    ctx.arc(size / 2 - 3, size * 0.11, Math.max(2, size * 0.02), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = COLOURS.hudPanel;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();
  }

  function hudReadout(x, y, label, value, unit) {
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x, y);
    ctx.fillStyle = COLOURS.hudText;
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText(value, x, y + 36);
    const valueWidth = ctx.measureText(value).width;
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillStyle = COLOURS.hudAccent;
    ctx.fillText(unit, x + valueWidth + 6, y + 36);
  }

  function drawCompass(state) {
    const cx = width / 2;
    const stripWidth = Math.min(460, width * 0.42);
    panel(cx - stripWidth / 2, 14, stripWidth, 46);
    const heading = headingDegrees(state.heading);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - stripWidth / 2 + 6, 18, stripWidth - 12, 38);
    ctx.clip();
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let tick = -90; tick <= 90; tick += 5) {
      const bearing = ((Math.round(heading / 5) * 5 + tick) % 360 + 360) % 360;
      const x = cx + (tick - (heading - Math.round(heading / 5) * 5)) * 3.2;
      const major = bearing % 45 === 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 48);
      ctx.lineTo(x, major ? 38 : 43);
      ctx.stroke();
      if (major) {
        const label = bearing === 0 ? 'N' : bearing === 45 ? 'NE' : bearing === 90 ? 'E' : bearing === 135 ? 'SE' : bearing === 180 ? 'S' : bearing === 225 ? 'SW' : bearing === 270 ? 'W' : 'NW';
        ctx.fillStyle = bearing === 0 ? COLOURS.hudAccent : '#ffffff';
        ctx.fillText(label, x, 34);
      }
    }
    ctx.restore();
    ctx.fillStyle = COLOURS.hudAccent;
    ctx.beginPath();
    ctx.moveTo(cx - 7, 60);
    ctx.lineTo(cx + 7, 60);
    ctx.lineTo(cx, 70);
    ctx.closePath();
    ctx.fill();
  }

  function drawMinimap(state) {
    const size = 168;
    const x = width - size - 16;
    const y = height - size - 16;
    panel(x, y, size, size);
    const toMap = (wx, wz) => [x + 12 + ((wx + 1100) / 3900) * (size - 24), y + size - 12 - ((wz + 500) / 5000) * (size - 24)];
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const start = toMap(HOME_RUNWAY.x, HOME_RUNWAY.z);
    ctx.moveTo(start[0], start[1]);
    for (const ring of RINGS) {
      const point = toMap(ring.x, ring.z);
      ctx.lineTo(point[0], point[1]);
    }
    const far = toMap(FAR_RUNWAY.x, FAR_RUNWAY.z);
    ctx.lineTo(far[0], far[1]);
    ctx.stroke();
    RINGS.forEach((ring, index) => {
      const point = toMap(ring.x, ring.z);
      ctx.fillStyle = index < state.ringsPassed ? COLOURS.ringDone : index === state.ringsPassed ? COLOURS.ringNext : COLOURS.ringSoon;
      ctx.beginPath();
      ctx.arc(point[0], point[1], index === state.ringsPassed ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(start[0] - 2, start[1] - 7, 4, 14);
    ctx.fillRect(far[0] - 2, far[1] - 7, 4, 14);
    const plane = toMap(state.x, state.z);
    ctx.save();
    ctx.translate(plane[0], plane[1]);
    ctx.rotate(state.heading);
    ctx.fillStyle = COLOURS.hudAccent;
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(5, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('COURSE', x + 10, y + 16);
  }

  function drawFlightMarker(state) {
    const cx = width / 2;
    const cy = height / 2 - state.pitch * 120;
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy);
    ctx.lineTo(cx - 16, cy);
    ctx.moveTo(cx + 16, cy);
    ctx.lineTo(cx + 34, cy);
    ctx.moveTo(cx, cy - 26);
    ctx.lineTo(cx, cy - 16);
    ctx.stroke();
    const ring = RINGS[state.ringsPassed];
    if (ring) {
      const point = project(ring.x, ring.y, ring.z);
      const distance = Math.round(Math.hypot(ring.x - state.x, ring.y - state.y, ring.z - state.z));
      if (point && point.x > 30 && point.x < width - 30 && point.y > 30 && point.y < height - 30) {
        ctx.strokeStyle = COLOURS.ringNext;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      } else {
        const bearing = Math.atan2(ring.x - state.x, ring.z - state.z);
        let relative = bearing - state.heading;
        while (relative > Math.PI) relative -= Math.PI * 2;
        while (relative < -Math.PI) relative += Math.PI * 2;
        const arrowX = cx + Math.sin(relative) * 150;
        const arrowY = cy - Math.cos(relative) * 90;
        ctx.fillStyle = COLOURS.ringNext;
        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(relative);
        ctx.beginPath();
        ctx.moveTo(0, -16);
        ctx.lineTo(10, 10);
        ctx.lineTo(0, 4);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${state.ringsPassed + 1} · ${distance} m`, cx, cy + 52);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LAND ON THE FAR RUNWAY', cx, cy + 52);
    }
  }

  function drawHud(world, screen) {
    const state = world.state;
    panel(16, 14, 322, 132);
    hudReadout(30, 42, 'ALTITUDE', String(Math.round(feetFromMetres(Math.max(0, state.y - terrainHeight(state.x, state.z))))), 'ft AGL');
    hudReadout(30, 96, 'AIRSPEED', String(Math.round(knotsFromMetresPerSecond(state.speed))), 'kt');
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('HEADING', 196, 42);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText(`${String(Math.round(headingDegrees(state.heading))).padStart(3, '0')}°`, 196, 78);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('VERT SPEED', 196, 96);
    ctx.fillStyle = state.verticalSpeed < -6 ? COLOURS.warning : '#ffffff';
    ctx.font = '800 20px system-ui, sans-serif';
    ctx.fillText(`${state.verticalSpeed >= 0 ? '+' : ''}${Math.round(state.verticalSpeed * 196.85)} fpm`, 196, 124);
    drawCompass(state);
    panel(width - 268, 14, 252, 104);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RINGS', width - 252, 40);
    ctx.fillText('TIME', width - 252, 74);
    ctx.fillText('SCORE', width - 252, 104);
    ctx.fillStyle = COLOURS.hudAccent;
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillText(`${state.ringsPassed} / ${RINGS.length}`, width - 170, 42);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(formatClock(state.time), width - 170, 76);
    ctx.fillText(String(state.score), width - 170, 106);
    panel(16, height - 92, 252, 76);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText('THROTTLE', 30, height - 66);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(30, height - 56, 224, 16);
    ctx.fillStyle = state.throttle > 0.85 ? COLOURS.warning : COLOURS.hudAccent;
    ctx.fillRect(30, height - 56, 224 * state.throttle, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillText(`${Math.round(state.throttle * 100)}%`, 30, height - 24);
    ctx.fillText(state.airborne ? 'AIRBORNE' : 'ON GROUND', 130, height - 24);
    drawMinimap(state);
    if (screen === SCREEN_PLAY) drawFlightMarker(state);
    if (state.airborne && state.speed < 21 && screen === SCREEN_PLAY && Math.sin(state.time * 8) > -0.2) {
      ctx.fillStyle = COLOURS.warning;
      ctx.font = '900 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('STALL — NOSE DOWN, ADD POWER', width / 2, 118);
    }
    if (state.ringFlash > 0) {
      ctx.fillStyle = `rgba(255,210,62,${clamp(state.ringFlash, 0, 0.35)})`;
      ctx.fillRect(0, 0, width, height);
    }
    if (state.messageTime > 0 && screen === SCREEN_PLAY) {
      ctx.fillStyle = 'rgba(8,18,36,0.66)';
      const messageWidth = Math.max(320, state.message.length * 9.5);
      ctx.beginPath();
      ctx.roundRect(width / 2 - messageWidth / 2, 84, messageWidth, 38, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.message, width / 2, 109);
    }
  }

  function gauge(x, y, radius, label, valueText, fraction, colour = '#ffd23e') {
    ctx.fillStyle = '#101c2c';
    ctx.strokeStyle = colour;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    for (let tick = 0; tick <= 10; tick += 1) {
      const angle = Math.PI * 0.75 + (tick / 10) * Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(angle) * radius * 0.78, y + Math.sin(angle) * radius * 0.78);
      ctx.lineTo(x + Math.cos(angle) * radius * 0.92, y + Math.sin(angle) * radius * 0.92);
      ctx.stroke();
    }
    const needle = Math.PI * 0.75 + clamp(fraction, 0, 1) * Math.PI * 1.5;
    ctx.strokeStyle = '#ff5a4e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(needle) * radius * 0.72, y + Math.sin(needle) * radius * 0.72);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + radius * 0.55);
    ctx.font = '800 15px system-ui, sans-serif';
    ctx.fillText(valueText, x, y + radius + 18);
  }

  function drawCockpit(state) {
    const panelTop = height * 0.66;
    ctx.fillStyle = '#16222f';
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, panelTop + 40);
    ctx.quadraticCurveTo(width / 2, panelTop - 26, width, panelTop + 40);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0c141f';
    ctx.fillRect(0, 0, 26, height);
    ctx.fillRect(width - 26, 0, 26, height);
    ctx.fillRect(0, 0, width, 20);
    const centreY = panelTop + (height - panelTop) * 0.52;
    const radius = Math.min(54, height * 0.075);
    const altitude = Math.round(feetFromMetres(Math.max(0, state.y - terrainHeight(state.x, state.z))));
    const speed = Math.round(knotsFromMetresPerSecond(state.speed));
    gauge(width * 0.3, centreY, radius, 'SPEED kt', String(speed), speed / 190);
    gauge(width * 0.42, centreY, radius, 'ALT ft', String(altitude), altitude / 3000);
    // Attitude indicator.
    ctx.save();
    ctx.beginPath();
    ctx.arc(width * 0.54, centreY, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(width * 0.54, centreY);
    ctx.rotate(-state.roll);
    ctx.fillStyle = '#3f8fd2';
    ctx.fillRect(-radius, -radius - state.pitch * 60, radius * 2, radius + state.pitch * 60);
    ctx.fillStyle = '#7a5a35';
    ctx.fillRect(-radius, -state.pitch * 60, radius * 2, radius);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-radius, -state.pitch * 60);
    ctx.lineTo(radius, -state.pitch * 60);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width * 0.54, centreY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(width * 0.54 - 22, centreY);
    ctx.lineTo(width * 0.54 - 7, centreY);
    ctx.moveTo(width * 0.54 + 7, centreY);
    ctx.lineTo(width * 0.54 + 22, centreY);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', width * 0.54, centreY + radius + 18);
    gauge(width * 0.66, centreY, radius, 'HEADING', `${String(Math.round(headingDegrees(state.heading))).padStart(3, '0')}°`, headingDegrees(state.heading) / 360, '#54e0ff');
    gauge(width * 0.78, centreY, radius, 'V/S fpm', String(Math.round(state.verticalSpeed * 196.85)), (state.verticalSpeed + 12) / 24, '#69e58a');
    // Yoke.
    ctx.strokeStyle = '#05090f';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(width / 2, height + 10);
    ctx.lineTo(width / 2 + state.roll * 26, panelTop + 54);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 58 + state.roll * 26, panelTop + 48);
    ctx.quadraticCurveTo(width / 2 + state.roll * 26, panelTop + 66, width / 2 + 58 + state.roll * 26, panelTop + 48);
    ctx.stroke();
    ctx.fillStyle = '#ffd23e';
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AURORA RUNWAY', width / 2, panelTop + 30);
  }

  function overlayPanel(title, lines, accent = COLOURS.hudAccent) {
    ctx.fillStyle = 'rgba(5,12,24,0.52)';
    ctx.fillRect(0, 0, width, height);
    const boxWidth = Math.min(720, width - 60);
    const boxHeight = 150 + lines.length * 30;
    const x = width / 2 - boxWidth / 2;
    const y = height / 2 - boxHeight / 2;
    ctx.fillStyle = 'rgba(8,18,36,0.88)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x, y, boxWidth, boxHeight, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.font = '900 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, y + 62);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 19px system-ui, sans-serif';
    lines.forEach((line, index) => ctx.fillText(line, width / 2, y + 108 + index * 30));
  }

  function draw(world, screen, best, cameraMode) {
    const state = world.state;
    buildCamera(state, cameraMode);
    drawSky(state);
    drawTerrain(state);
    drawRunway(HOME_RUNWAY);
    drawRunway(FAR_RUNWAY);
    drawTrees(world.trees);
    drawRings(state);
    drawClouds(world.clouds);
    if (cameraMode === CAMERA_CHASE) {
      drawPlaneShadow(state);
      drawAircraft(state);
    } else {
      drawCockpit(state);
    }
    drawHud(world, screen);
    if (screen === SCREEN_TITLE) {
      overlayPanel('AURORA RUNWAY', [
        'Dawn takeoff · eight rings over river, coast and pass · land far',
        'Arrows / A D steer · W S throttle · mouse steers, wheel trims',
        'C cockpit · Space brake · P pause · R restart · M mute',
        best > 0 ? `Best score ${best} — press Enter or click to fly` : 'Press Enter or click to fly',
      ]);
    } else if (screen === SCREEN_PAUSED) {
      overlayPanel('PAUSED', ['Press P or Enter to keep flying', 'C switches between chase and cockpit views']);
    } else if (screen === SCREEN_OVER) {
      if (state.landed) {
        overlayPanel('COURSE COMPLETE', [
          `Rings ${state.ringsPassed} of ${RINGS.length} · time ${formatClock(state.time)}`,
          `Score ${state.score} · best ${Math.max(best, state.score)}`,
          'Press Enter or R to fly it again',
        ], COLOURS.ringDone);
      } else {
        overlayPanel('CRASHED', [
          `Rings ${state.ringsPassed} of ${RINGS.length} · score ${state.score}`,
          'Watch the stall warning and keep the descent gentle',
          'Press Enter or R to fly again',
        ], COLOURS.warning);
      }
    }
  }

  return { draw, resize };
}
