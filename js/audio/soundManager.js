// Todo el sonido se sintetiza con Web Audio: una milonga de fondo con
// "bandoneón", guitarra y bajo, más efectos (cartas, golpe, mate, puntos).
// Los gritos ("¡Truco!") usan la voz del navegador en español.

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let musicOn = false;
let schedulerTimer = null;
let nextNoteTime = 0;
let step = 0;
let voiceOn = true;

const BPM = 104;
const EIGHTH = 60 / BPM / 2;

function load(key, def) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === '1';
  } catch {
    return def;
  }
}
function save(key, val) {
  try {
    localStorage.setItem(key, val ? '1' : '0');
  } catch {
    /* sin storage no pasa nada */
  }
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  musicGain = ctx.createGain();
  musicGain.gain.value = 0.22;
  musicGain.connect(master);
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.7;
  sfxGain.connect(master);
  voiceOn = load('truco-voice', true);
  if (load('truco-music', true)) startMusic();
}

export const isMusicOn = () => musicOn;
export const isVoiceOn = () => voiceOn;

export function toggleMusic() {
  initAudio();
  if (musicOn) stopMusic();
  else startMusic();
  save('truco-music', musicOn);
  return musicOn;
}

export function toggleVoice() {
  voiceOn = !voiceOn;
  save('truco-voice', voiceOn);
  return voiceOn;
}

// ---------- instrumentos ----------

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function bandoneon(note, t, dur, vel = 0.5) {
  const f = midi(note);
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1700;
  lp.Q.value = 2;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel * 0.32, t + 0.04);
  g.gain.setValueAtTime(vel * 0.3, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, t + dur);
  const vib = ctx.createOscillator();
  const vibG = ctx.createGain();
  vib.frequency.value = 5.5;
  vibG.gain.value = 3;
  vib.connect(vibG);
  for (const [type, det, gain] of [['sawtooth', -7, 0.5], ['sawtooth', 7, 0.5], ['square', 1200, 0.15]]) {
    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = det;
    vibG.connect(o.detune);
    og.gain.value = gain;
    o.connect(og).connect(lp);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  vib.start(t);
  vib.stop(t + dur + 0.05);
  lp.connect(g).connect(musicGain);
}

function pluck(note, t, vel = 0.4, dest = musicGain) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.exponentialRampToValueAtTime(500, t + 0.25);
  o.type = 'triangle';
  o.frequency.value = midi(note);
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(lp).connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.4);
}

function bass(note, t, vel = 0.6) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = midi(note);
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(g).connect(musicGain);
  o.start(t);
  o.stop(t + 0.32);
}

// ---------- la milonga ----------
// Compás de 2/4 en corcheas con acento 3-3-2. Am | E7 | Am | Dm | Am | E7 | Am | E7
const CHORDS = [
  { root: 45, notes: [57, 60, 64] },
  { root: 40, notes: [56, 59, 62] },
  { root: 45, notes: [57, 60, 64] },
  { root: 38, notes: [57, 62, 65] },
  { root: 45, notes: [57, 60, 64] },
  { root: 40, notes: [56, 59, 62] },
  { root: 45, notes: [57, 60, 64] },
  { root: 40, notes: [56, 59, 64] },
];
// Melodía (nota MIDI o null) por corchea, 8 compases x 8 corcheas (dos vueltas de 2/4 por compás).
const MELODY = [
  76, null, null, 74, null, null, 72, null, 71, null, null, 72, null, null, 74, null,
  72, null, null, 71, null, null, 69, null, 72, null, 71, 69, null, null, 68, null,
  69, null, null, 71, null, null, 72, null, 74, null, null, 76, null, null, 77, null,
  76, null, 74, null, 72, null, 71, null, 69, null, null, null, 68, null, 71, null,
];
const ACCENTS = [1, 0, 0, 1, 0, 0, 1, 0];

function scheduleStep(t) {
  const bar = Math.floor(step / 8) % CHORDS.length;
  const pos = step % 8;
  const chord = CHORDS[bar];
  if (ACCENTS[pos]) bass(pos === 3 ? chord.root + 7 : chord.root, t, pos === 0 ? 0.7 : 0.5);
  if (pos === 1 || pos === 4 || pos === 7) chord.notes.forEach((n, i) => pluck(n, t + i * 0.012, 0.12));
  const m = MELODY[step % MELODY.length];
  if (m) {
    let len = 1;
    while (len < 4 && MELODY[(step + len) % MELODY.length] === null) len++;
    bandoneon(m, t, len * EIGHTH * 0.95, ACCENTS[pos] ? 0.6 : 0.45);
  }
  step++;
}

function scheduler() {
  while (nextNoteTime < ctx.currentTime + 0.15) {
    scheduleStep(nextNoteTime);
    nextNoteTime += EIGHTH;
  }
}

function startMusic() {
  if (!ctx || musicOn) return;
  musicOn = true;
  nextNoteTime = ctx.currentTime + 0.1;
  schedulerTimer = setInterval(scheduler, 40);
}

function stopMusic() {
  musicOn = false;
  clearInterval(schedulerTimer);
}

// ---------- efectos ----------

function noise(dur) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

const SFX = {
  card() {
    const t = ctx.currentTime;
    const n = noise(0.08);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(f).connect(g).connect(sfxGain);
    n.start(t);
  },
  slam() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(g).connect(sfxGain);
    o.start(t);
    o.stop(t + 0.3);
    const n = noise(0.12);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    n.connect(ng).connect(sfxGain);
    n.start(t);
  },
  mate() {
    const t = ctx.currentTime;
    const n = noise(1.1);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(600, t);
    f.frequency.linearRampToValueAtTime(1800, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    for (let i = 0; i < 6; i++) {
      g.gain.linearRampToValueAtTime(0.5, t + i * 0.16 + 0.05);
      g.gain.linearRampToValueAtTime(0.08, t + i * 0.16 + 0.14);
    }
    g.gain.linearRampToValueAtTime(0, t + 1.05);
    n.connect(f).connect(g).connect(sfxGain);
    n.start(t);
  },
  point() {
    const t = ctx.currentTime;
    [76, 83].forEach((nn, i) => pluck(nn, t + i * 0.09, 0.35, sfxGain));
  },
  win() {
    const t = ctx.currentTime;
    [69, 73, 76, 81, 85, 88].forEach((nn, i) => pluck(nn, t + i * 0.11, 0.4, sfxGain));
  },
  lose() {
    const t = ctx.currentTime;
    [69, 68, 65, 64].forEach((nn, i) => pluck(nn, t + i * 0.18, 0.35, sfxGain));
  },
  canto() {
    const t = ctx.currentTime;
    [57, 64, 69].forEach((nn) => pluck(nn, t, 0.3, sfxGain));
  },
  pop() {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(500, t);
    o.frequency.exponentialRampToValueAtTime(900, t + 0.08);
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(sfxGain);
    o.start(t);
    o.stop(t + 0.12);
  },
};

export function sfx(name) {
  if (!ctx || !SFX[name]) return;
  try {
    SFX[name]();
  } catch {
    /* el audio nunca debe romper el juego */
  }
}

let spanishVoice = null;
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'es-AR') ||
    voices.find((v) => v.lang === 'es-US' || v.lang === 'es-MX') ||
    voices.find((v) => v.lang && v.lang.startsWith('es')) ||
    null
  );
}

export function shout(text, { pitch = 1, rate = 1.05 } = {}) {
  if (!voiceOn || !('speechSynthesis' in window)) return;
  try {
    spanishVoice = spanishVoice || pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = spanishVoice ? spanishVoice.lang : 'es-AR';
    if (spanishVoice) u.voice = spanishVoice;
    u.pitch = pitch;
    u.rate = rate;
    u.volume = 1;
    speechSynthesis.speak(u);
  } catch {
    /* sin voz no pasa nada */
  }
}
