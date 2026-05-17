/* ═══════════════════════════════════════
       Web Audio – sounds synthesised on the fly
    ═══════════════════════════════════════ */
let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

/**
 * Mechanical click:
 *  – short white-noise burst filtered to a mid-freq "snap"
 *  – layered with a fast-decaying low thump
 */
function playClick() {
  const ctx = getCtx();
  const t = ctx.currentTime;

  // — Noise snap —
  const samples = Math.floor(ctx.sampleRate * 0.045);
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = Math.random() * 2 - 1;

  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = buffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = "bandpass";
  bandpass.frequency.value = 1100;
  bandpass.Q.value = 0.9;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.32, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

  noiseSrc.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSrc.start(t);
  noiseSrc.stop(t + 0.05);

  // — Low thump —
  const thump = ctx.createOscillator();
  thump.type = "sine";
  thump.frequency.setValueAtTime(190, t);
  thump.frequency.exponentialRampToValueAtTime(55, t + 0.065);

  const thumpGain = ctx.createGain();
  thumpGain.gain.setValueAtTime(0.52, t);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

  thump.connect(thumpGain);
  thumpGain.connect(ctx.destination);
  thump.start(t);
  thump.stop(t + 0.08);
}

/**
 * Soft bell:
 *  – three sine partials (fundamental + harmonics) with short attack, long decay
 *  – a second, slightly lower ring after ~420 ms
 *  – gentle low-pass to keep it warm, not piercing
 */
function playBell() {
  const ctx = getCtx();

  function ring(freq, peak, decay, delay = 0) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth"; // sine, square, sawtooth, or triangle
    osc.frequency.value = freq;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; // Types include: lowpass, highpass, bandpass, lowshelf, highshelf, peaking, notch, allpass
    lp.frequency.value = 1000;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.0000002); // soft attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);

    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  // First strike – bright harmonics
  // ring(880, 0.45, 1.9);
  // ring(1320, 0.22, 1.3); // E note
  // ring(2200, 0.09, 0.75);

  // Second strike – a touch lower, softer
  // ring(660, 0.32, 1.5, 0.42);
  // ring(990, 0.14, 1.0, 0.4); // B note

  // ring(1760, 0.22, 1.3, 0.8); // A note

  // https://nch-nch.ru/frequency/
  //third octave
  ring(1046, 0.22, 2.3, 0); // С note

  ring(1174, 0.22, 2.3, 0.4); // В note

  ring(1318, 0.22, 2.3, 0.8); // E note

  // ring(1397, 0.22, 1.3, 1.2); // F note

  // ring(1568, 0.22, 1.3, 1.6); // G note

  // ring(1720, 0.22, 1.3, 2.0); // A note

  // ring(1975, 0.22, 1.3, 2.4); // B note
}

/* ═══════════════════════════════════════
       Timer logic
    ═══════════════════════════════════════ */

const CIRCUMFERENCE = 2 * Math.PI * 168; // ≈ 1055.6

const ring = document.getElementById("progressRing");
const display = document.getElementById("timerDisplay");
const label = document.getElementById("timerLabel");
const controlBtn = document.getElementById("controlBtn");
const modeBtns = document.querySelectorAll(".mode-btn");

const LABELS = { 25: "фокус", 5: "короткий отдых", 15: "длинный отдых" };

let totalSeconds = 25 * 60;
let remainSeconds = totalSeconds;
let intervalId = null;
let isRunning = false;

ring.style.strokeDasharray = CIRCUMFERENCE;
ring.style.strokeDashoffset = 0;

/* ── helpers ── */
function formatTime(s) {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function setProgress(fraction) {
  // fraction 1 = full ring, 0 = empty
  ring.style.strokeDashoffset = CIRCUMFERENCE * (1 - fraction);
}

function setMode(minutes) {
  stop();
  totalSeconds = minutes * 60;
  remainSeconds = totalSeconds;
  label.textContent = LABELS[minutes] || "";
  display.textContent = formatTime(remainSeconds);

  setProgress(1);
}

function tick() {
  if (remainSeconds <= 0) {
    complete();
    return;
  }
  remainSeconds--;
  display.textContent = formatTime(remainSeconds);
  setProgress(remainSeconds / totalSeconds);

  // Warning: last 60 seconds
  if (remainSeconds <= 60) {
    display.classList.add("warning");
    ring.style.stroke = "#ff4f4f";
  }
}

function start() {
  if (isRunning) return;
  isRunning = true;
  controlBtn.textContent = "Стоп";
  controlBtn.classList.add("running");
  ring.classList.add("running-glow");
  intervalId = setInterval(tick, 1000);
}

function stop() {
  if (!isRunning && intervalId === null) return;
  isRunning = false;
  clearInterval(intervalId);
  intervalId = null;
  controlBtn.textContent = "Старт";
  controlBtn.classList.remove("running");
  ring.classList.remove("running-glow");
  ring.style.stroke = ""; // reset to CSS var
  display.classList.remove("warning");
  // reset to current mode
  display.textContent = formatTime(remainSeconds);
}

function complete() {
  stop();
  // Reset
  remainSeconds = totalSeconds;
  display.textContent = formatTime(remainSeconds);
  setProgress(1);

  playBell(); // 🔔 soft bell on finish

  // Flash animation
  display.classList.add("flash");
  display.addEventListener(
    "animationend",
    () => display.classList.remove("flash"),
    { once: true },
  );
}

/* ── events ── */
controlBtn.addEventListener("click", () => {
  playClick(); // 🖱 click sound on every start/stop
  isRunning ? stop() : start();
});

modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    setMode(parseInt(btn.dataset.minutes, 10));
  });
});

// Init
setProgress(1);

// document.body.innerHTML += `<button class="testSound">sound</button>`;

const soundTest = document.getElementById("testSound");
soundTest.addEventListener("click", () => {
  playClick(); // 🖱 click sound on every start/stop
});

const soundTestBell = document.getElementById("testBell");
soundTestBell.addEventListener("click", () => {
  playBell(); // 🖱 click sound on every start/stop
});
