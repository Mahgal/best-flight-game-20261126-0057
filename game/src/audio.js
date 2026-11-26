// Synthesised sound only: a throttle-tracking engine hum, a ring chime,
// a stall warning and a landing arpeggio, all WebAudio oscillators.

export function createAudio() {
  let context = null;
  let engineOscillator = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (context) return true;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return false;
    context = new AudioCtor();
    engineOscillator = context.createOscillator();
    engineOscillator.type = 'sawtooth';
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOscillator.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOscillator.start();
    return true;
  }

  function setEngine(throttle, flying) {
    if (!context || !engineOscillator) return;
    const target = muted || !flying ? 0 : 0.015 + throttle * 0.05;
    engineOscillator.frequency.setTargetAtTime(55 + throttle * 85, context.currentTime, 0.08);
    engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
  }

  function tone(frequency, seconds, gainValue, delay = 0) {
    if (!ensure() || muted) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(gainValue, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.02);
  }

  function ringChime() {
    tone(880, 0.18, 0.08);
    tone(1318, 0.28, 0.06, 0.07);
  }

  function stallWarning() {
    tone(220, 0.12, 0.05);
  }

  function crashThud() {
    tone(70, 0.4, 0.12);
    tone(48, 0.5, 0.1, 0.05);
  }

  function landingFanfare() {
    tone(523, 0.2, 0.07);
    tone(659, 0.2, 0.07, 0.12);
    tone(784, 0.34, 0.08, 0.24);
  }

  function toggleMute() {
    muted = !muted;
    if (muted && engineGain) engineGain.gain.value = 0;
    return muted;
  }

  return { ensure, setEngine, ringChime, stallWarning, crashThud, landingFanfare, toggleMute };
}
