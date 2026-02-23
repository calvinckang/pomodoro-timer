// Pomodoro Timer
const WORK_DURATION_SEC = 25 * 60;
const BREAK_DURATION_SEC = 5 * 60;

const appEl = document.getElementById('app');
const modeIndicatorEl = document.getElementById('mode-indicator');
const timeDisplayEl = document.getElementById('time-display');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');

let timeRemaining = WORK_DURATION_SEC;
let isRunning = false;
let currentMode = 'work';
let tickIntervalId = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function tick() {
  if (!isRunning) return;
  timeRemaining -= 1;
  if (timeRemaining <= 0) {
    currentMode = currentMode === 'work' ? 'break' : 'work';
    timeRemaining = currentMode === 'work' ? WORK_DURATION_SEC : BREAK_DURATION_SEC;
  }
  render();
}

function startPause() {
  isRunning = !isRunning;
  if (isRunning) {
    tickIntervalId = setInterval(tick, 1000);
    startPauseBtn.textContent = 'Pause';
  } else {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
    startPauseBtn.textContent = 'Start';
  }
}

function reset() {
  isRunning = false;
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
  currentMode = 'work';
  timeRemaining = WORK_DURATION_SEC;
  startPauseBtn.textContent = 'Start';
  render();
}

function render() {
  timeDisplayEl.textContent = formatTime(timeRemaining);
  const modeLabel = currentMode === 'work' ? 'Work' : 'Break';
  modeIndicatorEl.textContent = modeLabel;
  appEl.setAttribute('data-mode', currentMode);
}

startPauseBtn.addEventListener('click', startPause);
resetBtn.addEventListener('click', reset);

render();
