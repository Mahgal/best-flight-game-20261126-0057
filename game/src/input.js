// Keyboard and mouse flight controls. Arrows or A/D bank, Up/Down climb
// and descend, W/S work the throttle; moving the mouse steers toward the
// pointer and the wheel trims throttle, so either device can fly alone.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CAMERA = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;
  let wheelDelta = 0;

  function onKeyDown(event) {
    const code = event.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(code);
    if (code === 'Enter' || code === 'Space') actions |= ACTION_CONFIRM;
    if (code === 'KeyP' || code === 'Escape') actions |= ACTION_PAUSE;
    if (code === 'KeyC') actions |= ACTION_CAMERA;
    if (code === 'KeyM') actions |= ACTION_MUTE;
    if (code === 'KeyR') actions |= ACTION_RESTART;
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    mouseSeen = true;
  }

  function onMouseDown() {
    actions |= ACTION_CONFIRM;
  }

  function onWheel(event) {
    event.preventDefault();
    wheelDelta += event.deltaY < 0 ? 0.18 : -0.18;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function flightInput() {
    let pitch = 0;
    let roll = 0;
    let throttleDelta = 0;
    if (keys.has('ArrowUp')) pitch += 1;
    if (keys.has('ArrowDown')) pitch -= 1;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
    if (keys.has('KeyW')) throttleDelta += 1;
    if (keys.has('KeyS')) throttleDelta -= 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) throttleDelta += 1;
    if (mouseSeen && pitch === 0 && roll === 0) {
      if (Math.abs(mouseX) > 0.12) roll = Math.max(-1, Math.min(1, mouseX * 1.4));
      if (Math.abs(mouseY) > 0.12) pitch = Math.max(-1, Math.min(1, -mouseY * 1.2));
    }
    if (wheelDelta !== 0) {
      throttleDelta += wheelDelta > 0 ? 1 : -1;
    }
    const brake = keys.has('Space') || keys.has('KeyB');
    return { pitch, roll, throttleDelta, brake };
  }

  function consumeWheel() {
    wheelDelta = 0;
  }

  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { flightInput, takeActions, consumeWheel };
}
