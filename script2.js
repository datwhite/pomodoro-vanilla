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
    osc.type = "sine";
    osc.frequency.value = freq;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 4000;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012); // soft attack
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);

    osc.connect(lp);
    lp.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  // First strike – bright harmonics
  ring(880, 0.45, 1.9);
  ring(1320, 0.22, 1.3);
  ring(2200, 0.09, 0.75);

  // Second strike – a touch lower, softer
  ring(660, 0.32, 1.5, 0.42);
  ring(990, 0.14, 1.0, 0.42);
}

/* ═══════════════════════════════════════
       Web Worker — inline via Blob URL
       Runs in a separate thread, never throttled
       by the browser's background tab policy.
       Sends { type:'tick', remain } every second.
    ═══════════════════════════════════════ */
const WORKER_SRC = `
      let intervalId   = null;
      let remain       = 0;
      let startedAt    = 0;   // performance.now() inside the worker
      let remainAtStart = 0;
 
      // Drift-corrected tick: schedule the next call so it lands
      // as close to a whole-second boundary as possible.
      function scheduleTick() {
        const elapsed = (performance.now() - startedAt) / 1000;
        const target  = Math.ceil(elapsed);           // next whole second
        const delay   = (target - elapsed) * 1000;    // ms until that moment
        intervalId = setTimeout(tick, Math.max(0, delay));
      }
 
      function tick() {
        const elapsed = Math.floor((performance.now() - startedAt) / 1000);
        remain = Math.max(0, remainAtStart - elapsed);
        postMessage({ type: 'tick', remain });
        if (remain > 0) scheduleTick();
        // remain === 0 → main thread handles 'done' via the last tick message
      }
 
      self.onmessage = ({ data }) => {
        switch (data.cmd) {
          case 'start':
            remainAtStart = data.remain;
            startedAt     = performance.now();
            remain        = data.remain;
            clearTimeout(intervalId);
            scheduleTick();
            break;
          case 'stop':
            clearTimeout(intervalId);
            break;
        }
      };
    `;

const workerBlob = new Blob([WORKER_SRC], { type: "application/javascript" });
const worker = new Worker(URL.createObjectURL(workerBlob));

/* ═══════════════════════════════════════
       Timer logic  (main thread)
    ═══════════════════════════════════════ */
const CIRCUMFERENCE = 2 * Math.PI * 168;

const ring = document.getElementById("progressRing");
const display = document.getElementById("timerDisplay");
const label = document.getElementById("timerLabel");
const controlBtn = document.getElementById("controlBtn");
const modeBtns = document.querySelectorAll(".mode-btn");

const LABELS = { 25: "фокус", 5: "короткий отдых", 15: "длинный отдых" };

let totalSeconds = 25 * 60;
let remainSeconds = totalSeconds;
let isRunning = false;

ring.style.strokeDasharray = CIRCUMFERENCE;
ring.style.strokeDashoffset = 0;

/* ── Helpers ── */
function formatTime(s) {
  const m = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

function setProgress(fraction) {
  ring.style.strokeDashoffset =
    CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, fraction)));
}

function render(secs) {
  display.textContent = formatTime(secs);
  setProgress(secs / totalSeconds);
  if (secs <= 60) {
    display.classList.add("warning");
    ring.style.stroke = "var(--danger)";
  } else {
    display.classList.remove("warning");
    ring.style.stroke = "";
  }
}

/* ── Worker message handler ── */
worker.onmessage = ({ data }) => {
  if (data.type !== "tick") return;
  remainSeconds = data.remain;
  render(remainSeconds);
  if (remainSeconds <= 0) complete();
};

/* ── Timer controls ── */
function startTimer() {
  if (isRunning) return;
  isRunning = true;
  controlBtn.textContent = "Стоп";
  controlBtn.classList.add("running");
  ring.classList.add("running-glow");
  worker.postMessage({ cmd: "start", remain: remainSeconds });
}

function stopTimer() {
  if (!isRunning) return;
  isRunning = false;
  worker.postMessage({ cmd: "stop" });
  controlBtn.textContent = "Старт";
  controlBtn.classList.remove("running");
  ring.classList.remove("running-glow");
  ring.style.stroke = "";
  display.classList.remove("warning");
  render(remainSeconds);
}

function complete() {
  // Guard: complete() may be called by worker; ensure it runs once
  if (!isRunning) return;
  stopTimer();
  remainSeconds = totalSeconds;
  render(remainSeconds);

  playBell();

  display.classList.add("flash");
  display.addEventListener(
    "animationend",
    () => display.classList.remove("flash"),
    { once: true },
  );
}

function setMode(minutes) {
  if (isRunning) stopTimer();
  totalSeconds = minutes * 60;
  remainSeconds = totalSeconds;
  label.textContent = LABELS[minutes] || "";
  display.classList.remove("warning");
  ring.style.stroke = "";
  render(remainSeconds);
}

/* ── Events ── */
controlBtn.addEventListener("click", () => {
  playClick();
  if (isRunning) stopTimer();
  else startTimer();
});

modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    setMode(parseInt(btn.dataset.minutes, 10));
  });
});

setProgress(1);
