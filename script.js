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
