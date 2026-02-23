// Pomodoro Timer
const DEFAULT_WORK_MIN = 25;
const DEFAULT_BREAK_MIN = 5;

let workDurationSec = DEFAULT_WORK_MIN * 60;
let breakDurationSec = DEFAULT_BREAK_MIN * 60;

const appEl = document.getElementById('app');
const modeIndicatorEl = document.getElementById('mode-indicator');
const timeDisplayEl = document.getElementById('time-display');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPopover = document.getElementById('settings-popover');
const workInput = document.getElementById('settings-work-input');
const workDecreaseBtn = document.getElementById('settings-work-decrease');
const workIncreaseBtn = document.getElementById('settings-work-increase');
const breakInput = document.getElementById('settings-break-input');
const breakDecreaseBtn = document.getElementById('settings-break-decrease');
const breakIncreaseBtn = document.getElementById('settings-break-increase');
const settingsCancelBtn = document.getElementById('settings-cancel-btn');
const settingsSaveBtn = document.getElementById('settings-save-btn');
const workResetBtn = document.getElementById('settings-work-reset');
const breakResetBtn = document.getElementById('settings-break-reset');
const settingsCloseBtn = document.getElementById('settings-close-btn');

let timeRemaining = workDurationSec;
let isRunning = false;
let currentMode = 'work';
let tickIntervalId = null;
let isSettingsOpen = false;

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
    timeRemaining = currentMode === 'work' ? workDurationSec : breakDurationSec;
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
  timeRemaining = workDurationSec;
  startPauseBtn.textContent = 'Start';
  render();
}

function render() {
  timeDisplayEl.textContent = formatTime(timeRemaining);
  const modeLabel = currentMode === 'work' ? 'Work' : 'Break';
  modeIndicatorEl.textContent = modeLabel;
  appEl.setAttribute('data-mode', currentMode);
}

function syncSettingsInputsFromState() {
  const workMinutes = Math.round(workDurationSec / 60);
  const breakMinutes = Math.round(breakDurationSec / 60);
  workInput.value = String(workMinutes);
  breakInput.value = String(breakMinutes);
}

function clampMinutes(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function openSettings() {
  isSettingsOpen = true;
  settingsPopover.setAttribute('aria-hidden', 'false');
  settingsBtn.setAttribute('aria-expanded', 'true');
  // Keep popover aligned right with the Settings button (clear any inline position overrides)
  settingsPopover.style.removeProperty('left');
  settingsPopover.style.removeProperty('top');
  syncSettingsInputsFromState();
  workInput.focus();
}

function closeSettings() {
  isSettingsOpen = false;
  settingsPopover.setAttribute('aria-hidden', 'true');
  settingsBtn.setAttribute('aria-expanded', 'false');
}

function toggleSettings() {
  if (isSettingsOpen) {
    closeSettings();
  } else {
    openSettings();
  }
}

function applySettings() {
  const rawWork = parseInt(workInput.value, 10);
  const rawBreak = parseInt(breakInput.value, 10);

  const workMinutes = clampMinutes(rawWork, 1, 180);
  const breakMinutes = clampMinutes(rawBreak, 1, 60);

  workDurationSec = workMinutes * 60;
  breakDurationSec = breakMinutes * 60;

  // Apply new duration to current segment so the timer display updates immediately
  timeRemaining = currentMode === 'work' ? workDurationSec : breakDurationSec;

  render();
}

function stepInput(inputEl, delta, min, max) {
  const current = parseInt(inputEl.value || '0', 10);
  const next = clampMinutes(current + delta, min, max);
  inputEl.value = String(next);
}

startPauseBtn.addEventListener('click', startPause);
resetBtn.addEventListener('click', reset);
settingsBtn.addEventListener('click', toggleSettings);

settingsCancelBtn.addEventListener('click', () => {
  // Revert any unsaved edits
  syncSettingsInputsFromState();
  closeSettings();
});

settingsSaveBtn.addEventListener('click', () => {
  applySettings();
  closeSettings();
});

settingsCloseBtn.addEventListener('click', () => {
  closeSettings();
});

workDecreaseBtn.addEventListener('click', () => {
  stepInput(workInput, -1, 1, 180);
});

workIncreaseBtn.addEventListener('click', () => {
  stepInput(workInput, 1, 1, 180);
});

breakDecreaseBtn.addEventListener('click', () => {
  stepInput(breakInput, -1, 1, 60);
});

breakIncreaseBtn.addEventListener('click', () => {
  stepInput(breakInput, 1, 1, 60);
});

workResetBtn.addEventListener('click', () => {
  workInput.value = String(DEFAULT_WORK_MIN);
});

breakResetBtn.addEventListener('click', () => {
  breakInput.value = String(DEFAULT_BREAK_MIN);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isSettingsOpen) {
    closeSettings();
  }
});

render();
