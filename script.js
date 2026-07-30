/* Любовен Дъжд - шест нива, синтезиран звук, mobile first.
   Личните текстове и настройките на нивата са в story.js */

/* ========== DOM ========== */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const gameWrap = document.querySelector(".game-wrap");

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const bestEl = document.getElementById("best");
const comboEl = document.getElementById("combo");
const levelNameEl = document.getElementById("levelName");
const levelFillEl = document.getElementById("levelFill");
const levelProgressTextEl = document.getElementById("levelProgressText");
const loveFillEl = document.getElementById("loveFill");
const loveTextEl = document.getElementById("loveText");
const hintLineEl = document.getElementById("hintLine");
const controlsHintEl = document.getElementById("controlsHint");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const restartBtn = document.getElementById("restartBtn");

const reviveBox = document.getElementById("reviveBox");
const reviveInput = document.getElementById("reviveInput");
const reviveBtn = document.getElementById("reviveBtn");
const reviveHint = document.getElementById("reviveHint");

const soundBtn = document.getElementById("soundBtn");
const pauseBtn = document.getElementById("pauseBtn");
const touchControls = document.getElementById("touchControls");

const dateProposal = document.getElementById("dateProposal");
const proposalQuestion = document.getElementById("proposalQuestion");
const proposalSubtext = document.getElementById("proposalSubtext");
const proposalDetails = document.getElementById("proposalDetails");
const proposalYesBtn = document.getElementById("proposalYesBtn");
const proposalMaybeBtn = document.getElementById("proposalMaybeBtn");
const proposalShareBtn = document.getElementById("proposalShareBtn");
const proposalReplayBtn = document.getElementById("proposalReplayBtn");
const confettiLayer = document.getElementById("confettiLayer");

/* ========== Помощни ========== */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = Number.parseInt(clean, 16);
  return String((bigint >> 16) & 255) + "," + String((bigint >> 8) & 255) + "," + String(bigint & 255);
}

function readStore(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (err) {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (err) {
    /* частен режим - продължаваме без запис */
  }
}

function countPoliteWords(text) {
  return (text.match(/моля/gi) || []).length;
}

/* ========== Свят (адаптивно платно) ========== */

const WORLD = { w: 360, h: 480, s: 1 };

function resizeCanvas() {
  const rect = gameWrap.getBoundingClientRect();
  const w = Math.max(240, Math.round(rect.width));
  const h = Math.max(240, Math.round(rect.height));
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);

  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  WORLD.w = w;
  WORLD.h = h;
  WORLD.s = clamp(Math.min(w, h) / 380, 0.78, 2);

  layoutLevel();

  /* Смяната на canvas.width изчиства платното - рисуваме веднага,
     за да няма празен кадър при завъртане на телефона. */
  render(performance.now());
}

/* мащаб за всичко нарисувано, за да е четимо и на малък екран */
function u(value) {
  return value * WORLD.s;
}

function font(size, weight) {
  return String(weight || 700) + " " + Math.round(u(size)) + "px Manrope, sans-serif";
}

/* ========== Звук (WebAudio, без външни файлове) ========== */

const audio = {
  ctx: null,
  master: null,
  musicBus: null,
  sfxBus: null,
  on: readStore("love-rain-sound", "on") !== "off",
  timer: null,
  nextTime: 0,
  step: 0,
  stepDur: 0.26,
  mood: "love",
  wave: "triangle",
};

const MOODS = {
  love: [
    [57, 60, 64, 67],
    [53, 57, 60, 64],
    [48, 55, 60, 64],
    [55, 59, 62, 67],
  ],
  finale: [
    [53, 57, 60, 65],
    [55, 59, 62, 67],
    [57, 60, 64, 69],
    [60, 64, 67, 72],
  ],
};

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function initAudio() {
  if (audio.ctx) {
    return;
  }
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) {
    return;
  }

  audio.ctx = new Ctor();
  audio.master = audio.ctx.createGain();
  audio.master.gain.value = audio.on ? 0.9 : 0;
  audio.master.connect(audio.ctx.destination);

  audio.musicBus = audio.ctx.createGain();
  audio.musicBus.gain.value = 0.26;
  audio.musicBus.connect(audio.master);

  audio.sfxBus = audio.ctx.createGain();
  audio.sfxBus.gain.value = 0.7;
  audio.sfxBus.connect(audio.master);
}

function unlockAudio() {
  initAudio();
  if (audio.ctx && audio.ctx.state === "suspended") {
    audio.ctx.resume();
  }
}

function tone(options) {
  if (!audio.ctx || !audio.on) {
    return;
  }

  const now = audio.ctx.currentTime;
  const start = now + (options.delay || 0);
  const dur = options.dur || 0.16;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();

  osc.type = options.type || "triangle";
  osc.frequency.setValueAtTime(options.freq, start);
  if (options.slideTo) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, options.slideTo), start + dur);
  }

  const peak = options.gain === undefined ? 0.3 : options.gain;
  const attack = options.attack === undefined ? 0.008 : options.attack;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  osc.connect(gain);
  gain.connect(options.bus === "music" ? audio.musicBus : audio.sfxBus);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noiseBurst(dur, gainValue) {
  if (!audio.ctx || !audio.on) {
    return;
  }

  const frames = Math.floor(audio.ctx.sampleRate * dur);
  const buffer = audio.ctx.createBuffer(1, frames, audio.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }

  const src = audio.ctx.createBufferSource();
  src.buffer = buffer;

  const filter = audio.ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400;

  const gain = audio.ctx.createGain();
  gain.gain.value = gainValue === undefined ? 0.18 : gainValue;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.sfxBus);
  src.start();
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

const sfx = {
  catch(comboCount) {
    const idx = clamp(Math.floor(comboCount / 2), 0, PENTA.length - 1);
    tone({ freq: midiToFreq(69 + PENTA[idx]), dur: 0.16, type: "triangle", gain: 0.26 });
    tone({ freq: midiToFreq(81 + PENTA[idx]), dur: 0.1, type: "sine", gain: 0.1, delay: 0.02 });
  },
  bonus() {
    [0, 4, 7, 12].forEach((offset, i) => {
      tone({ freq: midiToFreq(72 + offset), dur: 0.18, type: "triangle", gain: 0.22, delay: i * 0.055 });
    });
  },
  hurt() {
    tone({ freq: 320, slideTo: 90, dur: 0.42, type: "sawtooth", gain: 0.22 });
    noiseBurst(0.22, 0.14);
  },
  shield() {
    tone({ freq: 620, slideTo: 1180, dur: 0.22, type: "sine", gain: 0.2 });
  },
  pad(index) {
    const notes = [64, 67, 71, 76];
    tone({ freq: midiToFreq(notes[index]), dur: 0.3, type: "sine", gain: 0.26 });
  },
  perfect() {
    tone({ freq: midiToFreq(88), dur: 0.12, type: "sine", gain: 0.24 });
    tone({ freq: midiToFreq(95), dur: 0.1, type: "sine", gain: 0.12, delay: 0.04 });
  },
  good() {
    tone({ freq: midiToFreq(81), dur: 0.12, type: "triangle", gain: 0.2 });
  },
  miss() {
    tone({ freq: 200, slideTo: 130, dur: 0.18, type: "square", gain: 0.1 });
  },
  right() {
    [0, 4, 7].forEach((offset, i) => {
      tone({ freq: midiToFreq(72 + offset), dur: 0.2, type: "triangle", gain: 0.2, delay: i * 0.06 });
    });
  },
  wrong() {
    tone({ freq: 260, slideTo: 150, dur: 0.34, type: "square", gain: 0.14 });
  },
  levelUp() {
    [0, 4, 7, 12, 16].forEach((offset, i) => {
      tone({ freq: midiToFreq(69 + offset), dur: 0.3, type: "triangle", gain: 0.24, delay: i * 0.09 });
    });
  },
  win() {
    [0, 4, 7, 12, 14, 16, 19, 24].forEach((offset, i) => {
      tone({ freq: midiToFreq(69 + offset), dur: 0.45, type: "triangle", gain: 0.24, delay: i * 0.11 });
      tone({ freq: midiToFreq(57 + offset), dur: 0.5, type: "sine", gain: 0.12, delay: i * 0.11 });
    });
  },
  click() {
    tone({ freq: 720, dur: 0.07, type: "sine", gain: 0.14 });
  },
  type() {
    tone({ freq: rand(900, 1250), dur: 0.03, type: "sine", gain: 0.04 });
  },
};

function musicStep(step, when) {
  const chords = MOODS[audio.mood];
  const chord = chords[Math.floor(step / 8) % chords.length];
  const inBar = step % 8;

  if (inBar === 0) {
    tone({
      freq: midiToFreq(chord[0] - 12),
      dur: audio.stepDur * 5,
      type: "sine",
      gain: 0.2,
      attack: 0.03,
      bus: "music",
      delay: when,
    });
  }

  const arp = chord[inBar % chord.length] + (inBar >= 4 ? 12 : 0);
  tone({
    freq: midiToFreq(arp),
    dur: audio.stepDur * 1.8,
    type: audio.wave,
    gain: inBar % 2 === 0 ? 0.15 : 0.09,
    bus: "music",
    delay: when,
  });

  if (step % 16 === 14) {
    tone({
      freq: midiToFreq(chord[2] + 24),
      dur: audio.stepDur * 2.4,
      type: "sine",
      gain: 0.07,
      bus: "music",
      delay: when,
    });
  }
}

function scheduleMusic() {
  if (!audio.ctx) {
    return;
  }
  const lookahead = 0.14;
  while (audio.nextTime < audio.ctx.currentTime + lookahead) {
    const when = Math.max(0, audio.nextTime - audio.ctx.currentTime);
    musicStep(audio.step, when);
    audio.step += 1;
    audio.nextTime += audio.stepDur;
  }
}

function startMusic(stepDur, mood, wave) {
  initAudio();
  if (!audio.ctx) {
    return;
  }

  audio.stepDur = stepDur || 0.26;
  audio.mood = mood || "love";
  audio.wave = wave || "triangle";

  if (audio.timer) {
    return;
  }

  audio.nextTime = audio.ctx.currentTime + 0.08;
  audio.step = 0;
  audio.timer = setInterval(scheduleMusic, 25);
}

function stopMusic() {
  if (audio.timer) {
    clearInterval(audio.timer);
    audio.timer = null;
  }
}

function setSound(on) {
  audio.on = on;
  writeStore("love-rain-sound", on ? "on" : "off");
  soundBtn.textContent = on ? "🔊" : "🔇";
  soundBtn.setAttribute("aria-pressed", String(on));

  if (!on) {
    stopMusic();
    if (audio.master) {
      audio.master.gain.value = 0;
    }
    return;
  }

  unlockAudio();
  if (audio.master) {
    audio.master.gain.value = 0.9;
  }
  if (appState === STATE.PLAY || appState === STATE.PROPOSAL) {
    startMusic(audio.stepDur, audio.mood, audio.wave);
  }
}

/* ========== Рисуване ========== */

function roundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawHeart(x, y, size, color, rotation) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation || 0);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.8);
  ctx.bezierCurveTo(-size * 1.7, -size * 0.1, -size * 1.2, -size * 1.6, 0, -size * 0.8);
  ctx.bezierCurveTo(size * 1.2, -size * 1.6, size * 1.7, -size * 0.1, 0, size * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGoldHeart(x, y, size, rotation) {
  drawHeart(x, y, size, "#ffd88f", rotation);
  drawHeart(x, y, size * 0.56, "#fff4d6", rotation);
}

function drawBrokenHeart(x, y, size, rotation) {
  drawHeart(x, y, size, "#ff607f", rotation);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation || 0);
  ctx.strokeStyle = "rgba(85, 11, 28, 0.95)";
  ctx.lineWidth = Math.max(1.5, size * 0.14);
  ctx.beginPath();
  ctx.moveTo(-size * 0.1, -size * 0.95);
  ctx.lineTo(size * 0.15, -size * 0.3);
  ctx.lineTo(-size * 0.1, size * 0.05);
  ctx.lineTo(size * 0.16, size * 0.7);
  ctx.stroke();
  ctx.restore();
}

function drawElephant(x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);

  ctx.fillStyle = "#c6e9ff";
  ctx.beginPath();
  ctx.arc(-7.5, -2.5, 4.4, 0, Math.PI * 2);
  ctx.arc(7.5, -2.5, 4.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#c6e9ff";
  ctx.lineWidth = 3.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.quadraticCurveTo(2.6, 11, -1.4, 13.5);
  ctx.stroke();

  ctx.fillStyle = "#2c5671";
  ctx.beginPath();
  ctx.arc(-2.9, -1, 1, 0, Math.PI * 2);
  ctx.arc(2.9, -1, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* ========== Ефекти ========== */

let particles = [];
let ripples = [];
let floaters = [];
let trail = [];

function spawnBurst(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    const life = rand(0.4, 0.95);
    particles.push({
      x,
      y,
      vx: rand(-1, 1) * u(180),
      vy: rand(-1.2, 0.6) * u(180),
      life,
      maxLife: life,
      size: rand(u(2), u(6)),
      color,
    });
  }
}

function pushRipple(x, y, color) {
  ripples.push({ x, y, r: u(5), life: 0.52, maxLife: 0.52, color });
}

function pushFloater(x, y, text, color) {
  floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
}

function updateEffects(dt) {
  const nextParticles = [];
  for (const p of particles) {
    p.life -= dt;
    if (p.life <= 0) {
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += u(260) * dt;
    nextParticles.push(p);
  }
  particles = nextParticles;

  const nextRipples = [];
  for (const r of ripples) {
    r.life -= dt;
    if (r.life <= 0) {
      continue;
    }
    r.r += u(92) * dt;
    nextRipples.push(r);
  }
  ripples = nextRipples;

  const nextFloaters = [];
  for (const f of floaters) {
    f.life -= dt;
    if (f.life <= 0) {
      continue;
    }
    f.y -= u(46) * dt;
    nextFloaters.push(f);
  }
  floaters = nextFloaters;
}

function drawEffects() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.fillStyle = "rgba(" + p.color + "," + alpha + ")";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const r of ripples) {
    const alpha = r.life / r.maxLife;
    ctx.strokeStyle = "rgba(" + r.color + "," + alpha * 0.8 + ")";
    ctx.lineWidth = u(2);
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.textAlign = "center";
  ctx.font = font(15, 800);
  for (const f of floaters) {
    const alpha = clamp(f.life / f.maxLife, 0, 1);
    ctx.fillStyle = "rgba(" + f.color + "," + alpha + ")";
    ctx.fillText(f.text, f.x, f.y);
  }
}

/* ========== Състояние ========== */

const STATE = {
  INTRO: "intro",
  RULES: "rules",
  PLAY: "play",
  NOTE: "note",
  REVIVE: "revive",
  PAUSE: "pause",
  OVER: "over",
  PROPOSAL: "proposal",
};

const KEY = { left: false, right: false, up: false, down: false };

let appState = STATE.INTRO;
let overlayAction = "intro-start";
let pendingLevel = 0;
let currentLevel = 0;

let score = 0;
let lives = 3;
let best = Number(readStore("love-rain-best", "0")) || 0;
let combo = 0;
let love = 0;
let reviveUsed = false;

let runTime = 0;
let lastTime = performance.now();
let pulse = 0;
let shake = 0;

const boosts = { shield: false, slowUntil: -1, magnetUntil: -1 };

const catcherState = {
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  caught: 0,
  missed: 0,
  spawnTimer: 0,
  drops: [],
};

const dodgeState = {
  lanes: [0, 0, 0],
  laneIndex: 1,
  visualX: 0,
  runnerY: 0,
  elapsed: 0,
  spawnTimer: 0,
  obstacles: [],
};

const memoryState = {
  pads: [],
  sequence: [],
  inputIndex: 0,
  round: 1,
  phase: "show",
  timer: 0,
  showIndex: 0,
  activePad: -1,
};

const RHYTHM_LEAD = 1.7;

const rhythmState = {
  cols: [0, 0, 0, 0],
  colW: 0,
  hitY: 0,
  speed: 200,
  time: 0,
  notes: [],
  hits: 0,
  misses: 0,
  flash: [0, 0, 0, 0],
  judge: "",
  judgeTimer: 0,
};

const quizState = {
  boxes: [],
  order: [],
  index: 0,
  correct: 0,
  chosen: -1,
  locked: 0,
  note: "",
};

const rescueState = {
  x: 0,
  y: 0,
  r: 0,
  speed: 0,
  rescued: 0,
  elapsed: 0,
  spawnTimer: 0,
  items: [],
  targetX: null,
  targetY: null,
};

function level() {
  return LEVELS[currentLevel];
}

function slowFactor() {
  return runTime < boosts.slowUntil ? 0.52 : 1;
}

/* ========== Разположение по нива ========== */

function layoutLevel() {
  const mode = level().mode;

  if (mode === "catch") {
    catcherState.w = clamp(WORLD.w * 0.26, u(64), u(140));
    catcherState.h = u(16);
    catcherState.y = WORLD.h - u(26) - catcherState.h;
    catcherState.x =
      catcherState.x < 0
        ? (WORLD.w - catcherState.w) / 2
        : clamp(catcherState.x, 0, WORLD.w - catcherState.w);
  }

  if (mode === "dodge") {
    dodgeState.lanes = [WORLD.w * 0.2, WORLD.w * 0.5, WORLD.w * 0.8];
    dodgeState.visualX = dodgeState.lanes[dodgeState.laneIndex];
    dodgeState.runnerY = WORLD.h - u(54);
  }

  if (mode === "memory") {
    const top = u(46);
    const bottom = WORLD.h - u(34);
    const availH = Math.max(u(120), bottom - top);
    const availW = WORLD.w - u(20);
    const gap = u(10);
    const w = (availW - gap) / 2;
    const h = (availH - gap) / 2;
    const startX = (WORLD.w - (w * 2 + gap)) / 2;
    const startY = top + (availH - (h * 2 + gap)) / 2;

    memoryState.pads = [
      { x: startX, y: startY, w, h },
      { x: startX + w + gap, y: startY, w, h },
      { x: startX, y: startY + h + gap, w, h },
      { x: startX + w + gap, y: startY + h + gap, w, h },
    ];
  }

  if (mode === "rhythm") {
    rhythmState.colW = WORLD.w / 4;
    rhythmState.cols = [0, 1, 2, 3].map((i) => (i + 0.5) * rhythmState.colW);
    rhythmState.hitY = WORLD.h - u(56);
    rhythmState.speed = (rhythmState.hitY + u(40)) / RHYTHM_LEAD;
  }

  if (mode === "quiz") {
    const pad = u(10);
    const top = u(40);
    const questionH = clamp(WORLD.h * 0.28, u(80), u(150));
    const answersTop = top + questionH;
    const availH = WORLD.h - answersTop - pad;
    const gap = u(7);
    const boxH = (availH - gap * 3) / 4;

    quizState.boxes = [0, 1, 2, 3].map((i) => ({
      x: pad,
      y: answersTop + i * (boxH + gap),
      w: WORLD.w - pad * 2,
      h: boxH,
    }));
  }

  if (mode === "rescue") {
    rescueState.r = u(13);
    rescueState.speed = u(300);
    rescueState.x = clamp(rescueState.x || WORLD.w / 2, rescueState.r, WORLD.w - rescueState.r);
    rescueState.y = clamp(rescueState.y || WORLD.h * 0.7, u(40), WORLD.h - rescueState.r);
  }
}

/* ========== Награди и наказания ========== */

function hurt(x, y) {
  if (boosts.shield) {
    boosts.shield = false;
    combo = 0;
    pushRipple(x, y, "160,230,255");
    pushFloater(x, y, "Щитът пое удара!", "180,240,255");
    spawnBurst(x, y, "170,225,255", 14);
    shake = 0.2;
    sfx.shield();
    return;
  }

  lives -= 1;
  combo = 0;
  love = clamp(love - 14, 0, 100);
  shake = 0.34;
  canvas.classList.remove("hit");
  void canvas.offsetWidth;
  canvas.classList.add("hit");
  bump(livesEl);
  pushRipple(x, y, "255,95,125");
  spawnBurst(x, y, "255,120,145", 18);
  sfx.hurt();
}

const MAX_MULT = 8;

function comboMult() {
  return Math.min(MAX_MULT, 1 + Math.floor(combo / 4));
}

function reward(x, y, points, loveGain, label) {
  combo += 1;
  const mult = comboMult();
  score += points * mult;
  love = clamp(love + loveGain + mult, 0, 100);
  pulse = Math.min(1, pulse + 0.22);
  pushRipple(x, y, "255,212,145");
  spawnBurst(x, y, "255,220,228", 10 + mult * 2);
  pushFloater(x, y - u(16), label || "+" + points * mult, "255,240,205");
  sfx.catch(combo);
}

function bump(el) {
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function grantBoost(type, x, y) {
  if (type === "shield") {
    boosts.shield = true;
    pushFloater(x, y - u(16), "Щит 🛡", "180,240,255");
  } else if (type === "slow") {
    boosts.slowUntil = runTime + 6;
    pushFloater(x, y - u(16), "Забавяне ⏳", "215,205,255");
  } else if (type === "magnet") {
    boosts.magnetUntil = runTime + 7;
    pushFloater(x, y - u(16), "Магнит 🧲", "255,205,225");
  } else if (type === "life") {
    lives = Math.min(5, lives + 1);
    bump(livesEl);
    pushFloater(x, y - u(16), "Живот ❤", "255,190,205");
  }

  love = clamp(love + 6, 0, 100);
  pulse = Math.min(1, pulse + 0.3);
  spawnBurst(x, y, "255,240,210", 16);
  sfx.bonus();
}

const BOOST_ICON = { shield: "🛡", slow: "⏳", magnet: "🧲", life: "❤" };

function randomBoostType() {
  const pool = ["shield", "slow", "magnet"];
  if (lives < 3) {
    pool.push("life");
  }
  return pick(pool);
}

/* ========== Ниво 1: хващане ========== */

function spawnDrop() {
  const difficulty = clamp(catcherState.caught / level().goal, 0, 1);
  const roll = Math.random();
  let type = "good";

  if (roll < 0.05) {
    type = "boost";
  } else if (roll < 0.09) {
    type = "elephant";
  } else if (roll < 0.09 + 0.18 + difficulty * 0.16) {
    type = "bad";
  }

  const radius = rand(u(11), u(17));
  catcherState.drops.push({
    x: rand(radius, WORLD.w - radius),
    y: -radius,
    radius,
    speed: u(130 + difficulty * 90) + rand(0, u(70)),
    drift: rand(-u(30), u(30)),
    phase: rand(0, Math.PI * 2),
    rot: rand(0, Math.PI * 2),
    rotSpeed: rand(-2.2, 2.2),
    type,
    boost: type === "boost" ? randomBoostType() : null,
  });
}

function circleRectHit(circle, rx, ry, rw, rh) {
  const nx = clamp(circle.x, rx, rx + rw);
  const ny = clamp(circle.y, ry, ry + rh);
  const dx = circle.x - nx;
  const dy = circle.y - ny;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

function updateCatch(dt, now) {
  const dir = Number(KEY.right) - Number(KEY.left);
  catcherState.x = clamp(catcherState.x + dir * u(440) * dt, 0, WORLD.w - catcherState.w);

  const cx = catcherState.x + catcherState.w / 2;
  trail.push({ x: cx, y: catcherState.y + catcherState.h / 2 });
  if (trail.length > 16) {
    trail.shift();
  }

  catcherState.spawnTimer += dt * 1000;
  const gap = Math.max(620 - catcherState.caught * 10, 330);
  if (catcherState.spawnTimer >= gap) {
    catcherState.spawnTimer = 0;
    spawnDrop();
  }

  const magnetOn = runTime < boosts.magnetUntil;
  const slow = slowFactor();
  const next = [];

  for (const d of catcherState.drops) {
    d.y += d.speed * slow * dt;
    d.x += Math.sin(now * 0.002 + d.phase) * d.drift * dt;
    d.rot += d.rotSpeed * dt;

    if (magnetOn && d.type !== "bad") {
      d.x += (cx - d.x) * Math.min(1, dt * 3.4);
    }
    d.x = clamp(d.x, d.radius, WORLD.w - d.radius);

    if (circleRectHit(d, catcherState.x, catcherState.y, catcherState.w, catcherState.h)) {
      if (d.type === "good") {
        catcherState.caught += 1;
        reward(d.x, d.y, 1, 5);
      } else if (d.type === "elephant") {
        catcherState.caught += 2;
        reward(d.x, d.y, 4, 10, "Слонче +4");
      } else if (d.type === "boost") {
        grantBoost(d.boost, d.x, d.y);
      } else {
        hurt(d.x, d.y);
      }
      continue;
    }

    if (d.y - d.radius > WORLD.h) {
      /* Изпуснато добро сърце боли, но живот отива само на всяко трето -
         иначе с много сърца наведнъж нивото става невъзможно. */
      if (d.type === "good" || d.type === "elephant") {
        catcherState.missed += 1;
        combo = 0;
        love = clamp(love - 7, 0, 100);
        pushFloater(d.x, WORLD.h - u(24), "Изпуснато", "255,190,205");
        sfx.miss();
        if (catcherState.missed % 4 === 0) {
          hurt(d.x, WORLD.h - u(10));
        }
      }
      continue;
    }

    next.push(d);
  }

  catcherState.drops = next;

  if (catcherState.caught >= level().goal) {
    completeLevel();
  }
}

function drawCatch() {
  for (let i = 0; i < trail.length; i += 1) {
    const t = trail[i];
    const alpha = i / Math.max(1, trail.length);
    ctx.fillStyle = "rgba(255, 223, 170, " + alpha * 0.22 + ")";
    ctx.beginPath();
    ctx.arc(t.x, t.y, u(5) + alpha * u(7), 0, Math.PI * 2);
    ctx.fill();
  }

  const grad = ctx.createLinearGradient(catcherState.x, catcherState.y, catcherState.x + catcherState.w, catcherState.y + catcherState.h);
  grad.addColorStop(0, "#ffd995");
  grad.addColorStop(1, "#ff8ca8");
  ctx.fillStyle = grad;
  roundedRect(catcherState.x, catcherState.y, catcherState.w, catcherState.h, u(9));
  ctx.fill();
  drawHeart(catcherState.x + catcherState.w / 2, catcherState.y + catcherState.h / 2, u(5), "#fff2f4", 0);

  if (boosts.shield) {
    ctx.strokeStyle = "rgba(170, 230, 255, 0.85)";
    ctx.lineWidth = u(2.5);
    roundedRect(catcherState.x - u(5), catcherState.y - u(5), catcherState.w + u(10), catcherState.h + u(10), u(12));
    ctx.stroke();
  }

  for (const d of catcherState.drops) {
    if (d.type === "good") {
      drawGoldHeart(d.x, d.y, d.radius * 0.8, d.rot);
    } else if (d.type === "bad") {
      drawBrokenHeart(d.x, d.y, d.radius * 0.82, d.rot);
    } else if (d.type === "elephant") {
      drawElephant(d.x, d.y, d.radius * 1.7);
    } else {
      ctx.fillStyle = "rgba(255, 250, 225, 0.22)";
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.radius * 1.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "700 " + Math.round(d.radius * 1.35) + "px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(BOOST_ICON[d.boost], d.x, d.y);
      ctx.textBaseline = "alphabetic";
    }
  }
}

/* ========== Ниво 2: пътечки ========== */

function spawnObstacle() {
  const roll = Math.random();
  const type = roll > 0.92 ? "elephant" : roll > 0.5 ? "bad" : "good";
  dodgeState.obstacles.push({
    lane: Math.floor(Math.random() * 3),
    y: -u(20),
    size: u(type === "elephant" ? 12 : 11),
    speed: u(190) + rand(0, u(100)) + dodgeState.elapsed * u(4),
    type,
  });
}

function moveLane(delta) {
  const next = clamp(dodgeState.laneIndex + delta, 0, 2);
  if (next !== dodgeState.laneIndex) {
    dodgeState.laneIndex = next;
    sfx.click();
  }
}

function updateDodge(dt) {
  dodgeState.elapsed += dt;
  score += dt * 0.9;

  dodgeState.spawnTimer += dt * 1000;
  const gap = Math.max(480 - dodgeState.elapsed * 6, 240);
  if (dodgeState.spawnTimer >= gap) {
    dodgeState.spawnTimer = 0;
    spawnObstacle();
  }

  const targetX = dodgeState.lanes[dodgeState.laneIndex];
  dodgeState.visualX += (targetX - dodgeState.visualX) * Math.min(1, dt * 16);

  const slow = slowFactor();
  const next = [];

  for (const o of dodgeState.obstacles) {
    o.y += o.speed * slow * dt;

    const sameLane = o.lane === dodgeState.laneIndex;
    if (sameLane && Math.abs(o.y - dodgeState.runnerY) < u(20)) {
      const x = dodgeState.lanes[o.lane];
      if (o.type === "bad") {
        hurt(x, dodgeState.runnerY);
      } else if (o.type === "elephant") {
        reward(x, dodgeState.runnerY, 3, 9, "Слонче +3");
      } else {
        reward(x, dodgeState.runnerY, 1, 4);
      }
      continue;
    }

    if (o.y < WORLD.h + u(24)) {
      next.push(o);
    }
  }

  dodgeState.obstacles = next;

  if (dodgeState.elapsed >= level().goal) {
    completeLevel();
  }
}

function drawDodge() {
  for (const x of dodgeState.lanes) {
    ctx.strokeStyle = "rgba(255, 225, 240, 0.2)";
    ctx.lineWidth = u(2);
    ctx.setLineDash([u(8), u(10)]);
    ctx.beginPath();
    ctx.moveTo(x, u(44));
    ctx.lineTo(x, WORLD.h - u(16));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const glow = ctx.createRadialGradient(dodgeState.visualX, dodgeState.runnerY, u(4), dodgeState.visualX, dodgeState.runnerY, u(48));
  glow.addColorStop(0, "rgba(255, 220, 160, 0.32)");
  glow.addColorStop(1, "rgba(255, 220, 160, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(dodgeState.visualX - u(48), dodgeState.runnerY - u(48), u(96), u(96));

  drawGoldHeart(dodgeState.visualX, dodgeState.runnerY, u(12), 0);

  if (boosts.shield) {
    ctx.strokeStyle = "rgba(170, 230, 255, 0.8)";
    ctx.lineWidth = u(2.5);
    ctx.beginPath();
    ctx.arc(dodgeState.visualX, dodgeState.runnerY, u(22), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const o of dodgeState.obstacles) {
    const x = dodgeState.lanes[o.lane];
    if (o.type === "bad") {
      drawBrokenHeart(x, o.y, o.size, 0);
    } else if (o.type === "elephant") {
      drawElephant(x, o.y, o.size * 1.8);
    } else {
      drawGoldHeart(x, o.y, o.size, 0);
    }
  }
}

/* ========== Ниво 3: памет ========== */

function startMemoryRound() {
  while (memoryState.sequence.length < memoryState.round) {
    memoryState.sequence.push(Math.floor(Math.random() * 4));
  }
  memoryState.phase = "show";
  memoryState.timer = 0;
  memoryState.showIndex = 0;
  memoryState.inputIndex = 0;
  memoryState.activePad = -1;
}

function updateMemory(dt) {
  memoryState.timer += dt;

  if (memoryState.phase === "show") {
    if (memoryState.timer > 0.42) {
      memoryState.timer = 0;
      memoryState.activePad = -1;
      memoryState.phase = "gap";
    }
    return;
  }

  if (memoryState.phase === "gap") {
    if (memoryState.timer > 0.18) {
      memoryState.timer = 0;
      if (memoryState.showIndex >= memoryState.sequence.length) {
        memoryState.phase = "input";
        memoryState.activePad = -1;
        return;
      }
      memoryState.activePad = memoryState.sequence[memoryState.showIndex];
      sfx.pad(memoryState.activePad);
      memoryState.showIndex += 1;
      memoryState.phase = "show";
    }
    return;
  }

  if (memoryState.phase === "between" && memoryState.timer > 0.8) {
    memoryState.timer = 0;
    memoryState.round += 1;
    if (memoryState.round > level().goal) {
      completeLevel();
      return;
    }
    startMemoryRound();
  }
}

function tapMemory(x, y) {
  if (memoryState.phase !== "input") {
    return;
  }

  for (let i = 0; i < memoryState.pads.length; i += 1) {
    const p = memoryState.pads[i];
    if (x < p.x || x > p.x + p.w || y < p.y || y > p.y + p.h) {
      continue;
    }

    memoryState.activePad = i;
    memoryState.timer = 0;
    sfx.pad(i);

    if (memoryState.sequence[memoryState.inputIndex] === i) {
      memoryState.inputIndex += 1;
      reward(p.x + p.w / 2, p.y + p.h / 2, 1, 2);
      if (memoryState.inputIndex >= memoryState.sequence.length) {
        memoryState.phase = "between";
        memoryState.timer = 0;
        sfx.right();
        setHint(STORY.shortName + ", реда е верен. Рунд " + memoryState.round + " мина.");
      }
    } else {
      hurt(p.x + p.w / 2, p.y + p.h / 2);
      memoryState.phase = "gap";
      memoryState.timer = 0;
      memoryState.showIndex = 0;
      memoryState.inputIndex = 0;
      setHint("Пак отначало. Гледай внимателно.");
    }
    return;
  }
}

const PAD_COLORS = ["#ffd88f", "#ffb1c6", "#ffe8aa", "#f6c9ff"];

function drawMemory() {
  for (let i = 0; i < memoryState.pads.length; i += 1) {
    const p = memoryState.pads[i];
    const active = memoryState.activePad === i;

    ctx.fillStyle = active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.07)";
    roundedRect(p.x, p.y, p.w, p.h, u(14));
    ctx.fill();

    const size = Math.min(p.w, p.h) * (active ? 0.3 : 0.24);
    drawHeart(p.x + p.w / 2, p.y + p.h / 2, size, "rgba(" + hexToRgb(PAD_COLORS[i]) + "," + (active ? 1 : 0.62) + ")", 0);

    if (active) {
      ctx.strokeStyle = "rgba(255, 250, 222, 0.85)";
      ctx.lineWidth = u(3);
      roundedRect(p.x + u(2), p.y + u(2), p.w - u(4), p.h - u(4), u(12));
      ctx.stroke();
    }
  }
}

/* ========== Ниво 4: ритъм ========== */

/* Добавя още сърца в края на нотния лист. Викаме го и по време на нивото,
   за да не остане играчът без сърца, ако е изпуснал много. */
function extendRhythmChart(count) {
  const notes = rhythmState.notes;
  const beat = 0.44;
  let t = notes.length ? notes[notes.length - 1].time : RHYTHM_LEAD + 0.5;
  let lastCol = notes.length ? notes[notes.length - 1].col : -1;

  for (let i = 0; i < count; i += 1) {
    const density = clamp(notes.length / 26, 0, 1);
    t += beat * (Math.random() < 0.2 + density * 0.25 ? 0.5 : 1);

    let col = Math.floor(Math.random() * 4);
    if (col === lastCol && Math.random() < 0.6) {
      col = (col + 1 + Math.floor(Math.random() * 3)) % 4;
    }
    lastCol = col;

    notes.push({ time: t, col, hit: false, missed: false });
  }
}

function buildRhythmChart() {
  rhythmState.notes = [];
  extendRhythmChart(level().goal + 16);
}

function updateRhythm(dt) {
  rhythmState.time += dt;
  rhythmState.judgeTimer = Math.max(0, rhythmState.judgeTimer - dt);

  for (let i = 0; i < 4; i += 1) {
    rhythmState.flash[i] = Math.max(0, rhythmState.flash[i] - dt * 3.4);
  }

  for (const note of rhythmState.notes) {
    if (note.hit || note.missed) {
      continue;
    }
    if (rhythmState.time > note.time + 0.2) {
      note.missed = true;
      rhythmState.misses += 1;
      combo = 0;
      love = clamp(love - 6, 0, 100);
      rhythmState.judge = "Изпуснато";
      rhythmState.judgeTimer = 0.5;
      sfx.miss();

      if (rhythmState.misses % 4 === 0) {
        hurt(rhythmState.cols[note.col], rhythmState.hitY);
      }
    }
  }

  const last = rhythmState.notes[rhythmState.notes.length - 1];
  if (last && last.time < rhythmState.time + RHYTHM_LEAD * 2) {
    extendRhythmChart(12);
  }

  if (rhythmState.hits >= level().goal) {
    completeLevel();
  }
}

function hitRhythm(col) {
  rhythmState.flash[col] = 1;

  let target = null;
  let bestDiff = Infinity;

  for (const note of rhythmState.notes) {
    if (note.col !== col || note.hit || note.missed) {
      continue;
    }
    const diff = Math.abs(note.time - rhythmState.time);
    if (diff < bestDiff) {
      bestDiff = diff;
      target = note;
    }
  }

  if (!target || bestDiff > 0.18) {
    sfx.miss();
    return;
  }

  target.hit = true;
  rhythmState.hits += 1;
  const x = rhythmState.cols[col];

  if (bestDiff < 0.08) {
    rhythmState.judge = "Точно! 💖";
    reward(x, rhythmState.hitY, 3, 6, "Точно!");
    sfx.perfect();
  } else {
    rhythmState.judge = "Добре";
    reward(x, rhythmState.hitY, 1, 3, "Добре");
    sfx.good();
  }
  rhythmState.judgeTimer = 0.5;
}

const RHYTHM_COLORS = ["#ffd07f", "#ffa6c1", "#ffe08a", "#d2a6ff"];
const RHYTHM_KEYS = ["D", "F", "J", "K"];

function drawRhythm() {
  for (let i = 0; i < 4; i += 1) {
    const x = i * rhythmState.colW;
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.015)";
    ctx.fillRect(x, 0, rhythmState.colW, WORLD.h);

    if (rhythmState.flash[i] > 0) {
      const g = ctx.createLinearGradient(0, rhythmState.hitY - u(80), 0, rhythmState.hitY + u(20));
      g.addColorStop(0, "rgba(" + hexToRgb(RHYTHM_COLORS[i]) + ",0)");
      g.addColorStop(1, "rgba(" + hexToRgb(RHYTHM_COLORS[i]) + "," + rhythmState.flash[i] * 0.3 + ")");
      ctx.fillStyle = g;
      ctx.fillRect(x, rhythmState.hitY - u(80), rhythmState.colW, u(100));
    }
  }

  ctx.strokeStyle = "rgba(255, 240, 220, 0.5)";
  ctx.lineWidth = u(3);
  ctx.beginPath();
  ctx.moveTo(0, rhythmState.hitY);
  ctx.lineTo(WORLD.w, rhythmState.hitY);
  ctx.stroke();

  for (let i = 0; i < 4; i += 1) {
    ctx.strokeStyle = "rgba(" + hexToRgb(RHYTHM_COLORS[i]) + ",0.8)";
    ctx.lineWidth = u(2);
    ctx.beginPath();
    ctx.arc(rhythmState.cols[i], rhythmState.hitY, u(16) + rhythmState.flash[i] * u(6), 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 245, 230, 0.4)";
    ctx.font = font(11, 700);
    ctx.textAlign = "center";
    ctx.fillText(RHYTHM_KEYS[i], rhythmState.cols[i], rhythmState.hitY + u(34));
  }

  for (const note of rhythmState.notes) {
    if (note.hit) {
      continue;
    }
    const y = rhythmState.hitY - (note.time - rhythmState.time) * rhythmState.speed;
    if (y < -u(30) || y > WORLD.h + u(30)) {
      continue;
    }
    ctx.globalAlpha = note.missed ? 0.28 : 1;
    drawHeart(rhythmState.cols[note.col], y, u(13), RHYTHM_COLORS[note.col], 0);
    ctx.globalAlpha = 1;
  }

  if (rhythmState.judgeTimer > 0) {
    ctx.fillStyle = "rgba(255, 240, 210, " + clamp(rhythmState.judgeTimer * 2, 0, 1) + ")";
    ctx.font = font(20, 800);
    ctx.textAlign = "center";
    ctx.fillText(rhythmState.judge, WORLD.w / 2, rhythmState.hitY - u(96));
  }
}

/* ========== Ниво 5: въпроси ========== */

function shuffledIndexes(count) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    list.push(i);
  }
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

/* Платното се рисува и докато се четат правилата, тоест преди
   resetLevelState да е подредил въпросите - затова се оправяме сами. */
function currentQuestion() {
  if (!STORY.quiz.length) {
    return null;
  }
  if (!quizState.order.length) {
    quizState.order = shuffledIndexes(STORY.quiz.length);
  }
  return STORY.quiz[quizState.order[quizState.index % quizState.order.length]];
}

function updateQuiz(dt) {
  if (quizState.locked > 0) {
    quizState.locked -= dt;
    if (quizState.locked <= 0) {
      quizState.locked = 0;
      quizState.chosen = -1;
      quizState.note = "";
      quizState.index += 1;
      if (quizState.correct >= level().goal) {
        completeLevel();
      }
    }
  }
}

function tapQuiz(x, y) {
  if (quizState.locked > 0) {
    return;
  }

  for (let i = 0; i < quizState.boxes.length; i += 1) {
    const b = quizState.boxes[i];
    if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) {
      continue;
    }
    answerQuiz(i);
    return;
  }
}

function answerQuiz(index) {
  if (quizState.locked > 0) {
    return;
  }

  const question = currentQuestion();
  const box = quizState.boxes[index];
  if (!question || !box) {
    return;
  }

  quizState.chosen = index;
  quizState.locked = 1.5;

  if (index === question.correct) {
    quizState.correct += 1;
    quizState.note = question.note;
    reward(box.x + box.w / 2, box.y + box.h / 2, 4, 8, "Вярно!");
    sfx.right();
  } else {
    quizState.note = "Правилното е: " + question.answers[question.correct];
    hurt(box.x + box.w / 2, box.y + box.h / 2);
    sfx.wrong();
  }
}

function wrapText(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
}

function drawQuiz() {
  const question = currentQuestion();

  if (!question) {
    ctx.fillStyle = "rgba(255, 248, 251, 0.9)";
    ctx.font = font(15, 700);
    ctx.textAlign = "center";
    ctx.fillText("Добави въпроси в story.js", WORLD.w / 2, WORLD.h / 2);
    return;
  }

  const pad = u(14);

  ctx.textAlign = "center";
  ctx.font = font(16, 800);
  const lines = wrapText(question.q, WORLD.w - pad * 2);
  const lineH = u(21);
  const startY = u(56) + lineH;

  ctx.fillStyle = "rgba(255, 248, 251, 0.96)";
  for (let i = 0; i < lines.length; i += 1) {
    ctx.fillText(lines[i], WORLD.w / 2, startY + i * lineH);
  }

  if (quizState.note) {
    ctx.font = font(12, 600);
    ctx.fillStyle = "rgba(255, 232, 200, 0.9)";
    const noteLines = wrapText(quizState.note, WORLD.w - pad * 2);
    for (let i = 0; i < noteLines.length; i += 1) {
      ctx.fillText(noteLines[i], WORLD.w / 2, startY + lines.length * lineH + u(6) + i * u(16));
    }
  }

  for (let i = 0; i < quizState.boxes.length; i += 1) {
    const b = quizState.boxes[i];
    const isChosen = quizState.chosen === i;
    const isCorrect = quizState.locked > 0 && i === question.correct;

    let fill = "rgba(255,255,255,0.09)";
    let stroke = "rgba(255, 235, 245, 0.34)";
    if (isCorrect) {
      fill = "rgba(150, 235, 180, 0.28)";
      stroke = "rgba(180, 255, 205, 0.9)";
    } else if (isChosen) {
      fill = "rgba(255, 120, 145, 0.26)";
      stroke = "rgba(255, 160, 180, 0.9)";
    }

    ctx.fillStyle = fill;
    roundedRect(b.x, b.y, b.w, b.h, u(12));
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = u(1.6);
    roundedRect(b.x, b.y, b.w, b.h, u(12));
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.font = font(11, 700);
    ctx.fillStyle = "rgba(255, 235, 200, 0.7)";
    ctx.fillText(String(i + 1), b.x + u(12), b.y + b.h / 2 + u(4));

    ctx.font = font(13.5, 700);
    ctx.fillStyle = "rgba(255, 248, 251, 0.96)";
    const answerLines = wrapText(question.answers[i], b.w - u(44));
    const ah = u(17);
    const ay = b.y + b.h / 2 - ((answerLines.length - 1) * ah) / 2 + u(4);
    for (let j = 0; j < answerLines.length; j += 1) {
      ctx.fillText(answerLines[j], b.x + u(30), ay + j * ah);
    }
  }

  ctx.textAlign = "center";
}

/* ========== Ниво 6: спасяване ========== */

function spawnRescueItem() {
  const roll = Math.random();
  let type = "bad";
  if (roll < 0.36) {
    type = "elephant";
  } else if (roll < 0.62) {
    type = "good";
  } else if (roll < 0.69) {
    type = "boost";
  }

  /* малко въздух в началото на финала */
  if (type === "bad" && rescueState.elapsed < 3) {
    type = "elephant";
  }

  const size = u(type === "elephant" ? 14 : 12);

  rescueState.items.push({
    x: rand(size, WORLD.w - size),
    y: -size,
    size,
    speed: u(120) + rand(0, u(80)) + rescueState.rescued * u(3),
    homing: type === "bad" ? rand(0.15, 0.55) : 0,
    rot: rand(0, Math.PI * 2),
    rotSpeed: rand(-1.8, 1.8),
    type,
    boost: type === "boost" ? randomBoostType() : null,
  });
}

function updateRescue(dt) {
  rescueState.elapsed += dt;

  if (rescueState.targetX !== null) {
    rescueState.x += (rescueState.targetX - rescueState.x) * Math.min(1, dt * 14);
    rescueState.y += (rescueState.targetY - rescueState.y) * Math.min(1, dt * 14);
  } else {
    const dx = Number(KEY.right) - Number(KEY.left);
    const dy = Number(KEY.down) - Number(KEY.up);
    rescueState.x += dx * rescueState.speed * dt;
    rescueState.y += dy * rescueState.speed * dt;
  }

  rescueState.x = clamp(rescueState.x, rescueState.r, WORLD.w - rescueState.r);
  rescueState.y = clamp(rescueState.y, u(40) + rescueState.r, WORLD.h - rescueState.r);

  trail.push({ x: rescueState.x, y: rescueState.y });
  if (trail.length > 14) {
    trail.shift();
  }

  rescueState.spawnTimer += dt * 1000;
  const gap = Math.max(560 - rescueState.rescued * 12, 310);
  if (rescueState.spawnTimer >= gap) {
    rescueState.spawnTimer = 0;
    spawnRescueItem();
  }

  const slow = slowFactor();
  const next = [];

  for (const item of rescueState.items) {
    item.y += item.speed * slow * dt;
    item.rot += item.rotSpeed * dt;

    if (item.homing) {
      item.x += Math.sign(rescueState.x - item.x) * u(56) * item.homing * slow * dt;
    }
    item.x = clamp(item.x, item.size, WORLD.w - item.size);

    const dx = item.x - rescueState.x;
    const dy = item.y - rescueState.y;
    const reach = item.size + rescueState.r;

    if (dx * dx + dy * dy < reach * reach) {
      if (item.type === "elephant") {
        rescueState.rescued += 1;
        reward(item.x, item.y, 5, 8, "Спасено 🐘");
      } else if (item.type === "good") {
        reward(item.x, item.y, 2, 5);
      } else if (item.type === "boost") {
        grantBoost(item.boost, item.x, item.y);
      } else {
        hurt(item.x, item.y);
      }
      continue;
    }

    if (item.y - item.size < WORLD.h) {
      next.push(item);
    }
  }

  rescueState.items = next;

  if (rescueState.rescued >= level().goal) {
    completeLevel();
  }
}

function drawRescue() {
  for (let i = 0; i < trail.length; i += 1) {
    const t = trail[i];
    const alpha = i / Math.max(1, trail.length);
    ctx.fillStyle = "rgba(255, 210, 180, " + alpha * 0.2 + ")";
    ctx.beginPath();
    ctx.arc(t.x, t.y, u(4) + alpha * u(8), 0, Math.PI * 2);
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(rescueState.x, rescueState.y, u(3), rescueState.x, rescueState.y, u(42));
  glow.addColorStop(0, "rgba(255, 226, 180, 0.3)");
  glow.addColorStop(1, "rgba(255, 226, 180, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(rescueState.x - u(42), rescueState.y - u(42), u(84), u(84));

  drawGoldHeart(rescueState.x, rescueState.y, rescueState.r, 0);

  if (boosts.shield) {
    ctx.strokeStyle = "rgba(170, 230, 255, 0.8)";
    ctx.lineWidth = u(2.5);
    ctx.beginPath();
    ctx.arc(rescueState.x, rescueState.y, rescueState.r + u(8), 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const item of rescueState.items) {
    if (item.type === "elephant") {
      drawElephant(item.x, item.y, item.size * 1.8);
    } else if (item.type === "good") {
      drawGoldHeart(item.x, item.y, item.size * 0.85, item.rot);
    } else if (item.type === "boost") {
      ctx.fillStyle = "rgba(255, 250, 225, 0.22)";
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.size * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "700 " + Math.round(item.size * 1.4) + "px Manrope, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(BOOST_ICON[item.boost], item.x, item.y);
      ctx.textBaseline = "alphabetic";
    } else {
      drawBrokenHeart(item.x, item.y, item.size * 0.85, item.rot);
    }
  }
}

/* ========== Фон и общи слоеве ========== */

function drawBackground(now) {
  const theme = level().theme;
  ctx.clearRect(0, 0, WORLD.w, WORLD.h);

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  sky.addColorStop(0, theme[0]);
  sky.addColorStop(0.55, theme[1]);
  sky.addColorStop(1, theme[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  const count = WORLD.w < 400 ? 26 : 42;
  for (let i = 0; i < count; i += 1) {
    const x = (i * 127 + now * 0.02) % WORLD.w;
    const y = (i * 71 + now * 0.03) % WORLD.h;
    const size = ((i % 3) + 1) * WORLD.s * 0.8;
    ctx.fillStyle = "rgba(255, 233, 244, 0.4)";
    ctx.fillRect(x, y, size, size);
  }

  for (let i = 0; i < 5; i += 1) {
    const x = ((i * 173 + now * 0.008) % (WORLD.w + u(60))) - u(30);
    const y = WORLD.h - (((i * 211 + now * 0.014) % (WORLD.h + u(80))) - u(40));
    ctx.globalAlpha = 0.07;
    drawHeart(x, y, u(10 + (i % 3) * 5), "#fff0f6", i * 0.4);
    ctx.globalAlpha = 1;
  }
}

function drawPulse() {
  if (pulse <= 0.01) {
    return;
  }
  const g = ctx.createRadialGradient(WORLD.w / 2, WORLD.h * 0.7, u(30), WORLD.w / 2, WORLD.h * 0.7, WORLD.w * 0.85);
  g.addColorStop(0, "rgba(255, 219, 166, " + pulse * 0.18 + ")");
  g.addColorStop(1, "rgba(255, 219, 166, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
}

function objectiveText() {
  const lv = level();
  if (lv.mode === "catch") {
    return "Сърца: " + catcherState.caught + " / " + lv.goal + "   ✗ " + catcherState.missed;
  }
  if (lv.mode === "dodge") {
    return "Оцелей още " + Math.max(0, Math.ceil(lv.goal - dodgeState.elapsed)) + " сек";
  }
  if (lv.mode === "memory") {
    const round = "Рунд " + Math.min(memoryState.round, lv.goal) + " / " + lv.goal + " - ";
    if (memoryState.phase === "input") {
      return round + "твой ред";
    }
    if (memoryState.phase === "between") {
      return round + "браво!";
    }
    return round + "гледай";
  }
  if (lv.mode === "rhythm") {
    return "Удари: " + rhythmState.hits + " / " + lv.goal + "   ✗ " + rhythmState.misses;
  }
  if (lv.mode === "quiz") {
    return "Верни: " + quizState.correct + " / " + lv.goal;
  }
  return "Слончета: " + rescueState.rescued + " / " + lv.goal;
}

function drawTopBar() {
  const g = ctx.createLinearGradient(0, 0, 0, u(40));
  g.addColorStop(0, "rgba(20, 2, 14, 0.5)");
  g.addColorStop(1, "rgba(20, 2, 14, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, u(40));

  ctx.fillStyle = "rgba(" + level().accent + ", 0.95)";
  ctx.font = font(14, 800);
  ctx.textAlign = "center";
  ctx.fillText(objectiveText(), WORLD.w / 2, u(24));

  const icons = [];
  if (boosts.shield) {
    icons.push("🛡");
  }
  if (runTime < boosts.slowUntil) {
    icons.push("⏳");
  }
  if (runTime < boosts.magnetUntil) {
    icons.push("🧲");
  }
  if (icons.length) {
    ctx.textAlign = "left";
    ctx.font = font(14, 700);
    ctx.fillText(icons.join(" "), u(10), u(24));
  }

  if (combo >= 4) {
    const mult = comboMult();
    const bob = Math.sin(performance.now() * 0.006) * u(4);
    ctx.textAlign = "center";
    ctx.font = font(19, 800);
    ctx.fillStyle = "rgba(255, 238, 190, 0.95)";
    ctx.fillText("РОМАНТИЧНО x" + mult + (mult === MAX_MULT ? " МАКС" : ""), WORLD.w / 2, u(52) + bob);
  }
}

function render(now) {
  drawBackground(now);

  const mode = level().mode;
  if (mode === "catch") {
    drawCatch();
  } else if (mode === "dodge") {
    drawDodge();
  } else if (mode === "memory") {
    drawMemory();
  } else if (mode === "rhythm") {
    drawRhythm();
  } else if (mode === "quiz") {
    drawQuiz();
  } else {
    drawRescue();
  }

  drawEffects();
  drawPulse();
  drawTopBar();
}

/* ========== HUD ========== */

const hudCache = {};

function setText(el, key, value) {
  if (hudCache[key] === value) {
    return;
  }
  hudCache[key] = value;
  el.textContent = value;
}

function levelProgress() {
  const lv = level();
  if (lv.mode === "catch") {
    return catcherState.caught / lv.goal;
  }
  if (lv.mode === "dodge") {
    return dodgeState.elapsed / lv.goal;
  }
  if (lv.mode === "memory") {
    return (memoryState.round - 1) / lv.goal;
  }
  if (lv.mode === "rhythm") {
    return rhythmState.hits / lv.goal;
  }
  if (lv.mode === "quiz") {
    return quizState.correct / lv.goal;
  }
  return rescueState.rescued / lv.goal;
}

function updateHud() {
  setText(scoreEl, "score", String(Math.floor(score)));
  setText(livesEl, "lives", lives > 0 ? "❤".repeat(lives) : "—");
  setText(bestEl, "best", String(best));
  setText(comboEl, "combo", "x" + String(comboMult()));
  setText(levelNameEl, "levelName", "Ниво " + level().id + " / " + LEVELS.length);

  const progress = Math.round(clamp(levelProgress(), 0, 1) * 100);
  setText(levelProgressTextEl, "levelPct", progress + "%");
  if (hudCache.levelFill !== progress) {
    hudCache.levelFill = progress;
    levelFillEl.style.width = progress + "%";
  }

  const lovePct = Math.round(love);
  setText(loveTextEl, "lovePct", lovePct + "%");
  if (hudCache.loveFill !== lovePct) {
    hudCache.loveFill = lovePct;
    loveFillEl.style.width = lovePct + "%";
  }
}

function setHint(text) {
  hintLineEl.textContent = text;
}

/* Таен пропуск за тестване: 5 клика по слончето или по заглавието
   прескачат текущото ниво. Броенето се нулира след 3 секунди без клик,
   за да не се задейства случайно от играча. */
const SKIP_TAPS_NEEDED = 5;
let skipTaps = 0;
let skipResetTimer = null;

function tapToSkip() {
  if (appState !== STATE.PLAY) {
    return;
  }

  skipTaps += 1;
  clearTimeout(skipResetTimer);
  skipResetTimer = setTimeout(() => {
    skipTaps = 0;
  }, 3000);

  const left = SKIP_TAPS_NEEDED - skipTaps;
  if (left > 0) {
    pushFloater(WORLD.w / 2, WORLD.h / 2, "🐘 " + left, "255,240,205");
    sfx.click();
    return;
  }

  skipTaps = 0;
  pushFloater(WORLD.w / 2, WORLD.h / 2, "Прескочено 🐘", "255,240,205");
  sfx.bonus();
  completeLevel();
}

/* ========== Управление за докосване ========== */

const TOUCH_LAYOUTS = {
  catch: {
    cols: 2,
    buttons: [
      { label: "◀", act: "left", hold: true },
      { label: "▶", act: "right", hold: true },
    ],
    hint: "Плъзни пръст по полето или <kbd>←</kbd> <kbd>→</kbd>",
  },
  dodge: {
    cols: 2,
    buttons: [
      { label: "◀ Наляво", act: "lane-left" },
      { label: "Надясно ▶", act: "lane-right" },
    ],
    hint: "Свайп по полето или <kbd>←</kbd> <kbd>→</kbd> за смяна на пътечка",
  },
  memory: {
    cols: 0,
    buttons: [],
    hint: "Натискай сърцата в полето",
  },
  rhythm: {
    cols: 4,
    buttons: [
      { label: "1", act: "col0", cls: "col-0" },
      { label: "2", act: "col1", cls: "col-1" },
      { label: "3", act: "col2", cls: "col-2" },
      { label: "4", act: "col3", cls: "col-3" },
    ],
    hint: "Тапни колоната или <kbd>D</kbd> <kbd>F</kbd> <kbd>J</kbd> <kbd>K</kbd>",
  },
  quiz: {
    cols: 0,
    buttons: [],
    hint: "Натисни отговора или <kbd>1</kbd> - <kbd>4</kbd>",
  },
  rescue: {
    cols: 4,
    buttons: [
      { label: "◀", act: "left", hold: true },
      { label: "▲", act: "up", hold: true },
      { label: "▼", act: "down", hold: true },
      { label: "▶", act: "right", hold: true },
    ],
    hint: "Води сърцето с пръст или <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>",
  },
};

function doAction(act, down) {
  if (act === "left") {
    KEY.left = down;
  } else if (act === "right") {
    KEY.right = down;
  } else if (act === "up") {
    KEY.up = down;
  } else if (act === "down") {
    KEY.down = down;
  } else if (down && act === "lane-left") {
    moveLane(-1);
  } else if (down && act === "lane-right") {
    moveLane(1);
  } else if (down && act.startsWith("col")) {
    if (appState === STATE.PLAY) {
      hitRhythm(Number(act.slice(3)));
    }
  }
}

function buildTouchControls(mode) {
  const layout = TOUCH_LAYOUTS[mode];
  touchControls.innerHTML = "";
  touchControls.className = "touch-controls" + (layout.cols > 2 ? " cols-" + layout.cols : "");
  controlsHintEl.innerHTML = layout.hint;

  for (const def of layout.buttons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "touch-btn" + (def.cls ? " " + def.cls : "");
    btn.textContent = def.label;
    btn.setAttribute("aria-label", def.label);

    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      btn.classList.add("pressed");
      doAction(def.act, true);
    });

    const release = () => {
      btn.classList.remove("pressed");
      if (def.hold) {
        doAction(def.act, false);
      }
    };

    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointercancel", release);
    btn.addEventListener("pointerleave", release);
    touchControls.appendChild(btn);
  }
}

function releaseAllKeys() {
  KEY.left = false;
  KEY.right = false;
  KEY.up = false;
  KEY.down = false;
  rescueState.targetX = null;
  rescueState.targetY = null;
}

/* ========== Текст на пишеща машина ========== */

let typeTimer = null;
let typeFull = "";

function finishTyping() {
  if (typeTimer) {
    clearInterval(typeTimer);
    typeTimer = null;
  }
  overlayText.textContent = typeFull;
  overlayText.classList.remove("typing");
}

function typeOverlay(text) {
  if (typeTimer) {
    clearInterval(typeTimer);
  }
  typeFull = text;
  overlayText.textContent = "";
  overlayText.classList.add("typing");

  let i = 0;
  typeTimer = setInterval(() => {
    i += 1;
    overlayText.textContent = typeFull.slice(0, i);
    if (i % 3 === 0) {
      sfx.type();
    }
    if (i >= typeFull.length) {
      finishTyping();
    }
  }, 24);
}

/* ========== Поток на играта ========== */

function showOverlay(title, text, buttonText, action, useTypewriter) {
  overlayTitle.textContent = title;
  restartBtn.textContent = buttonText;
  overlayAction = action;
  reviveBox.classList.add("hidden");
  overlay.classList.remove("hidden");
  restartBtn.classList.remove("hidden");

  if (useTypewriter) {
    typeOverlay(text);
  } else {
    finishTyping();
    typeFull = text;
    overlayText.textContent = text;
  }
}

function showIntro() {
  appState = STATE.INTRO;
  currentLevel = 0;
  layoutLevel();
  showOverlay("Любовен Дъжд", STORY.intro.join("\n"), "Да започваме 💘", "intro-start", true);
  setHint("🐘 Слончето пази късмета");
}

function showLevelRules(index) {
  appState = STATE.RULES;
  pendingLevel = index;
  currentLevel = index;
  layoutLevel();
  buildTouchControls(level().mode);
  updateHud();

  const lv = level();
  showOverlay(lv.title, lv.rules, "Започни", "begin-level", false);
}

function resetLevelState(index) {
  const mode = LEVELS[index].mode;
  trail = [];
  particles = [];
  ripples = [];
  floaters = [];
  boosts.shield = false;
  boosts.slowUntil = -1;
  boosts.magnetUntil = -1;

  if (mode === "catch") {
    catcherState.drops = [];
    catcherState.caught = 0;
    catcherState.missed = 0;
    catcherState.spawnTimer = 0;
    catcherState.x = -1;
  } else if (mode === "dodge") {
    dodgeState.obstacles = [];
    dodgeState.laneIndex = 1;
    dodgeState.elapsed = 0;
    dodgeState.spawnTimer = 0;
  } else if (mode === "memory") {
    memoryState.sequence = [];
    memoryState.round = 1;
    memoryState.showIndex = 0;
    memoryState.inputIndex = 0;
    memoryState.activePad = -1;
    memoryState.phase = "gap";
    memoryState.timer = 0;
  } else if (mode === "rhythm") {
    rhythmState.time = 0;
    rhythmState.hits = 0;
    rhythmState.misses = 0;
    rhythmState.judge = "";
    rhythmState.judgeTimer = 0;
    rhythmState.flash = [0, 0, 0, 0];
  } else if (mode === "quiz") {
    quizState.order = shuffledIndexes(STORY.quiz.length);
    quizState.index = 0;
    quizState.correct = 0;
    quizState.chosen = -1;
    quizState.locked = 0;
    quizState.note = "";
  } else if (mode === "rescue") {
    rescueState.items = [];
    rescueState.rescued = 0;
    rescueState.elapsed = 0;
    rescueState.spawnTimer = 0;
    rescueState.x = 0;
    rescueState.y = 0;
    rescueState.targetX = null;
    rescueState.targetY = null;
    boosts.shield = true; /* слончето подарява щит за финала */
  }

  layoutLevel();

  if (mode === "memory") {
    startMemoryRound();
  } else if (mode === "rhythm") {
    buildRhythmChart();
  }
}

function startLevel(index) {
  currentLevel = index;
  resetLevelState(index);
  buildTouchControls(level().mode);
  releaseAllKeys();

  appState = STATE.PLAY;
  overlay.classList.add("hidden");
  reviveBox.classList.add("hidden");
  lastTime = performance.now();
  combo = 0;

  unlockAudio();
  stopMusic();
  startMusic(level().tempo, "love", index >= 3 ? "sawtooth" : "triangle");

  setHint(STORY.shortName + ", " + level().title.toLowerCase().replace("ниво " + level().id + ": ", "") + " - давай!");
  updateHud();
}

function saveBest() {
  const value = Math.floor(score);
  if (value > best) {
    best = value;
    writeStore("love-rain-best", best);
  }
}

function completeLevel() {
  appState = STATE.NOTE;
  releaseAllKeys();
  saveBest();
  updateHud();
  sfx.levelUp();
  spawnBurst(WORLD.w / 2, WORLD.h / 2, "255,230,236", 26);

  if (currentLevel >= LEVELS.length - 1) {
    openProposal();
    return;
  }

  const note = STORY.notes[currentLevel] || "Продължаваме.";
  showOverlay("Ниво минато 💗", note, "Продължи", "note-continue", true);
}

function showRevivePrompt() {
  appState = STATE.REVIVE;
  releaseAllKeys();
  overlayTitle.textContent = "Опа, любовна пауза";
  finishTyping();
  overlayText.textContent = "Кажи магическата фраза и ще получиш още един шанс.";
  restartBtn.textContent = "Предавам се";
  overlayAction = "giveup";
  reviveInput.value = "";
  reviveHint.textContent = 'Трябва да има поне ' + STORY.revivePolite + ' пъти "моля".';
  reviveBox.classList.remove("hidden");
  overlay.classList.remove("hidden");
}

/* Не връщаме играча в началото - продължава от нивото, на което е спрял. */
function gameOverScreen() {
  appState = STATE.OVER;
  releaseAllKeys();
  stopMusic();
  saveBest();
  updateHud();
  showOverlay(
    "Край на живота",
    STORY.shortName + ", събра " + Math.floor(score) + " любов.\n" + STORY.gameOver,
    "Пробвай пак " + level().title.split(":")[0].toLowerCase(),
    "retry-level",
    false
  );
}

function retryLevel() {
  lives = 3;
  reviveUsed = false;
  combo = 0;
  love = clamp(love, 0, 100);
  startLevel(currentLevel);
}

function checkLives() {
  if (lives > 0) {
    return;
  }
  if (!reviveUsed) {
    reviveUsed = true;
    showRevivePrompt();
    return;
  }
  gameOverScreen();
}

function tryRevive() {
  const text = reviveInput.value.trim().toLowerCase();
  const politeCount = countPoliteWords(text);

  if (text !== STORY.revivePhrase && politeCount < STORY.revivePolite) {
    const left = STORY.revivePolite - politeCount;
    reviveHint.textContent = 'Не стига. Искам още ' + left + ' пъти "моля".';
    sfx.wrong();
    return;
  }

  lives = 2;
  combo = 0;
  love = clamp(love + 20, 0, 100);
  boosts.shield = true;
  appState = STATE.PLAY;
  overlay.classList.add("hidden");
  reviveBox.classList.add("hidden");
  lastTime = performance.now();
  reviveInput.blur();

  startMusic(level().tempo, "love", audio.wave);
  setHint(STORY.shortName + ", магията проработи. Втори шанс и щит!");
  sfx.bonus();
  updateHud();
}

function startNewRun() {
  closeProposal();
  score = 0;
  lives = 3;
  combo = 0;
  love = 0;
  reviveUsed = false;
  runTime = 0;
  hudCache.levelFill = -1;
  hudCache.loveFill = -1;
  showLevelRules(0);
  updateHud();
}

function pauseGame() {
  if (appState !== STATE.PLAY) {
    return;
  }
  appState = STATE.PAUSE;
  releaseAllKeys();
  stopMusic();
  showOverlay("Пауза", "Играта чака. Сърцето също.", "Продължи", "resume", false);
}

function resumeGame() {
  appState = STATE.PLAY;
  overlay.classList.add("hidden");
  lastTime = performance.now();
  startMusic(level().tempo, "love", audio.wave);
}

/* ========== Финал ========== */

let maybeCount = 0;

function openProposal() {
  appState = STATE.PROPOSAL;
  releaseAllKeys();
  overlay.classList.add("hidden");
  touchControls.innerHTML = "";

  maybeCount = 0;
  proposalQuestion.textContent = STORY.fullName + ", " + STORY.proposal.question;
  proposalSubtext.textContent = STORY.proposal.subtext;
  proposalMaybeBtn.textContent = "Може бии...";
  proposalMaybeBtn.style.transform = "translate(0, 0) scale(1)";
  proposalMaybeBtn.classList.remove("hidden");
  proposalYesBtn.textContent = "Дааа 💘";
  proposalDetails.classList.add("hidden");
  proposalDetails.innerHTML = "";
  proposalShareBtn.classList.add("hidden");
  proposalShareBtn.textContent = "Сподели 💌";
  dateProposal.classList.remove("hidden");

  stopMusic();
  startMusic(0.22, "finale", "triangle");
  sfx.win();
  celebrate(10);
  dropConfetti(60);
}

function closeProposal() {
  dateProposal.classList.add("hidden");
  confettiLayer.innerHTML = "";
}

function celebrate(times) {
  for (let i = 0; i < times; i += 1) {
    const x = rand(u(40), WORLD.w - u(40));
    const y = rand(u(50), WORLD.h - u(50));
    spawnBurst(x, y, "255,230,236", 12);
    spawnBurst(x, y, "255,196,120", 8);
    pushRipple(x, y, "255,212,145");
  }
}

const CONFETTI_COLORS = ["#ffd166", "#ff6b8f", "#fff3c9", "#a9e8ff", "#d2a6ff", "#ffb37d"];

function dropConfetti(count) {
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("i");
    piece.style.left = rand(0, 100) + "%";
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDuration = rand(2.6, 5) + "s";
    piece.style.animationDelay = rand(0, 1.4) + "s";
    piece.style.width = rand(6, 11) + "px";
    piece.style.height = rand(10, 18) + "px";
    confettiLayer.appendChild(piece);
    setTimeout(() => piece.remove(), 7000);
  }
}

function acceptProposal() {
  proposalQuestion.textContent = STORY.proposal.yesTitle;
  proposalSubtext.textContent = STORY.proposal.yesText;
  proposalYesBtn.textContent = "Нямам търпение 💞";
  proposalMaybeBtn.classList.add("hidden");

  proposalDetails.innerHTML = "";
  for (const line of STORY.proposal.dateCard) {
    const li = document.createElement("li");
    li.textContent = line;
    proposalDetails.appendChild(li);
  }
  proposalDetails.classList.remove("hidden");
  proposalShareBtn.classList.remove("hidden");

  pulse = 1;
  celebrate(18);
  dropConfetti(90);
  sfx.win();
}

function dodgeMaybeButton() {
  maybeCount += 1;

  if (maybeCount >= STORY.maybeLines.length) {
    proposalMaybeBtn.textContent = STORY.maybeLines[STORY.maybeLines.length - 1];
    proposalMaybeBtn.style.transform = "translate(0, 0) scale(1)";
    acceptProposal();
    return;
  }

  const range = 26 + maybeCount * 6;
  const scale = Math.max(0.66, 1 - maybeCount * 0.07);
  proposalMaybeBtn.style.transform =
    "translate(" + rand(-range, range) + "px, " + rand(-14, 14) + "px) scale(" + scale + ")";
  proposalMaybeBtn.textContent = STORY.maybeLines[maybeCount - 1];

  celebrate(2);
  sfx.click();
}

function shareYes() {
  const text = STORY.proposal.shareText;
  if (navigator.share) {
    navigator.share({ title: "Любовен Дъжд", text }).catch(() => {});
    return;
  }
  if (navigator.clipboard) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        proposalShareBtn.textContent = "Копирано ✓";
      })
      .catch(() => {
        proposalShareBtn.textContent = text;
      });
    return;
  }
  proposalShareBtn.textContent = text;
}

/* ========== Цикъл ========== */

function update(dt, now) {
  if (appState === STATE.PROPOSAL) {
    updateEffects(dt);
    pulse = Math.max(0.25, pulse - dt * 0.3);
    shake = Math.max(0, shake - dt * 1.4);
    if (Math.random() < 0.06) {
      celebrate(1);
    }
    return;
  }

  if (appState !== STATE.PLAY) {
    updateEffects(dt);
    pulse = Math.max(0, pulse - dt * 0.45);
    shake = Math.max(0, shake - dt * 1.4);
    return;
  }

  runTime += dt;

  const mode = level().mode;
  if (mode === "catch") {
    updateCatch(dt, now);
  } else if (mode === "dodge") {
    updateDodge(dt);
  } else if (mode === "memory") {
    updateMemory(dt);
  } else if (mode === "rhythm") {
    updateRhythm(dt);
  } else if (mode === "quiz") {
    updateQuiz(dt);
  } else {
    updateRescue(dt);
  }

  pulse = Math.max(0, pulse - dt * 0.9);
  shake = Math.max(0, shake - dt * 1.35);
  updateEffects(dt);
  updateHud();

  if (appState === STATE.PLAY) {
    checkLives();
  }
}

let frameErrorLogged = false;

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;

  try {
    update(dt, now);

    const ox = shake > 0 ? Math.sin(now * 0.06) * u(9) * shake : 0;
    const oy = shake > 0 ? Math.cos(now * 0.07) * u(6) * shake : 0;
    ctx.save();
    try {
      ctx.translate(ox, oy);
      render(now);
    } finally {
      ctx.restore();
    }
  } catch (err) {
    /* Един лош кадър не бива да спира играта завинаги. */
    if (!frameErrorLogged) {
      frameErrorLogged = true;
      console.error("Любовен Дъжд: грешка в кадър", err);
    }
  }

  /* Винаги извън try - иначе цикълът умира. */
  requestAnimationFrame(frame);
}

/* ========== Вход ========== */

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * WORLD.w,
    y: ((event.clientY - rect.top) / rect.height) * WORLD.h,
  };
}

let swipeStartX = null;
let pointerDown = false;

function onPointerDown(event) {
  if (appState !== STATE.PLAY) {
    return;
  }

  canvas.setPointerCapture?.(event.pointerId);
  pointerDown = true;
  const point = canvasPoint(event);
  const mode = level().mode;

  if (mode === "memory") {
    tapMemory(point.x, point.y);
  } else if (mode === "quiz") {
    tapQuiz(point.x, point.y);
  } else if (mode === "rhythm") {
    hitRhythm(clamp(Math.floor(point.x / rhythmState.colW), 0, 3));
  } else if (mode === "catch") {
    catcherState.x = clamp(point.x - catcherState.w / 2, 0, WORLD.w - catcherState.w);
  } else if (mode === "dodge") {
    swipeStartX = point.x;
  } else if (mode === "rescue") {
    rescueState.targetX = point.x;
    rescueState.targetY = point.y;
  }
}

function onPointerMove(event) {
  if (!pointerDown || appState !== STATE.PLAY) {
    return;
  }

  const point = canvasPoint(event);
  const mode = level().mode;

  if (mode === "catch") {
    catcherState.x = clamp(point.x - catcherState.w / 2, 0, WORLD.w - catcherState.w);
  } else if (mode === "rescue") {
    rescueState.targetX = point.x;
    rescueState.targetY = point.y;
  } else if (mode === "dodge" && swipeStartX !== null) {
    const diff = point.x - swipeStartX;
    if (Math.abs(diff) > WORLD.w * 0.08) {
      moveLane(diff > 0 ? 1 : -1);
      swipeStartX = point.x;
    }
  }
}

function onPointerUp() {
  pointerDown = false;
  swipeStartX = null;
  rescueState.targetX = null;
  rescueState.targetY = null;
}

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", onPointerUp);

const RHYTHM_KEYMAP = { d: 0, f: 1, j: 2, k: 3, 1: 0, 2: 1, 3: 2, 4: 3 };

window.addEventListener("keydown", (event) => {
  if (event.target === reviveInput) {
    return;
  }

  const key = event.key.toLowerCase();
  const mode = level().mode;

  if (key === "escape" || key === "p") {
    if (appState === STATE.PLAY) {
      pauseGame();
    } else if (appState === STATE.PAUSE) {
      resumeGame();
    }
    return;
  }

  if (key === "m") {
    setSound(!audio.on);
    return;
  }

  if (appState !== STATE.PLAY) {
    return;
  }

  if (mode === "rhythm" && RHYTHM_KEYMAP[key] !== undefined) {
    event.preventDefault();
    hitRhythm(RHYTHM_KEYMAP[key]);
    return;
  }

  if (mode === "quiz" && key >= "1" && key <= "4") {
    event.preventDefault();
    answerQuiz(Number(key) - 1);
    return;
  }

  if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    KEY.left = true;
    if (mode === "dodge") {
      moveLane(-1);
    }
  } else if (key === "arrowright" || key === "d") {
    event.preventDefault();
    KEY.right = true;
    if (mode === "dodge") {
      moveLane(1);
    }
  } else if (key === "arrowup" || key === "w") {
    event.preventDefault();
    KEY.up = true;
  } else if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    KEY.down = true;
  }

  if (mode === "rescue") {
    rescueState.targetX = null;
    rescueState.targetY = null;
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    KEY.left = false;
  } else if (key === "arrowright" || key === "d") {
    KEY.right = false;
  } else if (key === "arrowup" || key === "w") {
    KEY.up = false;
  } else if (key === "arrowdown" || key === "s") {
    KEY.down = false;
  }
});

restartBtn.addEventListener("click", () => {
  sfx.click();

  if (overlayAction === "intro-start") {
    if (typeTimer) {
      finishTyping();
      return;
    }
    startNewRun();
    return;
  }

  if (overlayAction === "begin-level") {
    startLevel(pendingLevel);
    return;
  }

  if (overlayAction === "note-continue") {
    if (typeTimer) {
      finishTyping();
      return;
    }
    showLevelRules(currentLevel + 1);
    return;
  }

  if (overlayAction === "resume") {
    resumeGame();
    return;
  }

  if (overlayAction === "retry-level") {
    retryLevel();
    return;
  }

  startNewRun();
});

/* тап върху текста прескача пишещата машина */
overlayText.addEventListener("click", finishTyping);

reviveBtn.addEventListener("click", tryRevive);
reviveInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    tryRevive();
  }
});

soundBtn.addEventListener("click", () => setSound(!audio.on));
pauseBtn.addEventListener("click", () => {
  if (appState === STATE.PLAY) {
    pauseGame();
  } else if (appState === STATE.PAUSE) {
    resumeGame();
  }
});

proposalYesBtn.addEventListener("click", acceptProposal);
proposalMaybeBtn.addEventListener("click", dodgeMaybeButton);
proposalShareBtn.addEventListener("click", shareYes);
proposalReplayBtn.addEventListener("click", () => {
  sfx.click();
  startNewRun();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseGame();
  }
});

window.addEventListener("blur", () => {
  releaseAllKeys();
});

window.addEventListener("pointerdown", unlockAudio, { once: true });
window.addEventListener("keydown", unlockAudio, { once: true });

if (window.ResizeObserver) {
  new ResizeObserver(resizeCanvas).observe(gameWrap);
} else {
  window.addEventListener("resize", resizeCanvas);
}
window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 120));

/* ========== Старт ========== */

const gameTitleEl = document.getElementById("gameTitle");
gameTitleEl.textContent = "Любовен Дъжд за " + STORY.shortName;

/* и слончето, и заглавието водят до пропускане - слончето се крие
   на нисък екран, затова има и второ място */
hintLineEl.addEventListener("click", tapToSkip);
gameTitleEl.addEventListener("click", tapToSkip);
soundBtn.textContent = audio.on ? "🔊" : "🔇";
soundBtn.setAttribute("aria-pressed", String(audio.on));

resizeCanvas();
showIntro();
updateHud();
requestAnimationFrame(frame);
