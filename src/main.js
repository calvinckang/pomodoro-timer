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
const workErrorEl = document.getElementById('settings-work-error');
const breakErrorEl = document.getElementById('settings-break-error');

let timeRemaining = workDurationSec;
let isRunning = false;
let currentMode = 'work';
let tickIntervalId = null;
let isSettingsOpen = false;
let audioContext = null;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function ensureAudioContext() {
  if (audioContext) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function playNotificationSound() {
  try {
    if (!audioContext) ensureAudioContext();
    if (audioContext.state === 'suspended') audioContext.resume();
    const gain = audioContext.createGain();
    gain.gain.value = 0.25;
    gain.connect(audioContext.destination);
    const osc = audioContext.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(gain);
    osc.start(audioContext.currentTime);
    osc.stop(audioContext.currentTime + 0.15);
  } catch (_) {}
}

function triggerTimerFlash() {
  const flashClass = currentMode === 'work' ? 'timer-flash-work' : 'timer-flash-break';
  document.body.classList.add(flashClass);
  const onEnd = (e) => {
    if (e.animationName !== 'timer-flash-work' && e.animationName !== 'timer-flash-break') return;
    document.body.classList.remove(flashClass);
    document.body.removeEventListener('animationend', onEnd);
  };
  document.body.addEventListener('animationend', onEnd);
}

function tick() {
  if (!isRunning) return;
  timeRemaining -= 1;
  if (timeRemaining <= 0) {
    currentMode = currentMode === 'work' ? 'break' : 'work';
    timeRemaining = currentMode === 'work' ? workDurationSec : breakDurationSec;
    triggerTimerFlash();
    playNotificationSound();
  }
  render();
}

function startPause() {
  isRunning = !isRunning;
  if (isRunning) {
    ensureAudioContext();
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

function clearSettingsErrors() {
  workErrorEl.textContent = '';
  breakErrorEl.textContent = '';
  workInput.classList.remove('settings-number-input--error');
  breakInput.classList.remove('settings-number-input--error');
}

function isSettingsValueValid(value, min, max) {
  const raw = String(value).trim();
  if (!raw) return false;
  const n = Number(raw);
  return !Number.isNaN(n) && n >= min && n <= max;
}

function validateSettingsInputs() {
  clearSettingsErrors();

  let isValid = true;

  const rawWork = workInput.value.trim();
  const rawBreak = breakInput.value.trim();

  const workValue = Number(rawWork);
  const breakValue = Number(rawBreak);

  if (!rawWork || Number.isNaN(workValue) || workValue < 1 || workValue > 999) {
    workErrorEl.textContent = 'Work duration must be a number between 1 and 999 minutes.';
    workInput.classList.add('settings-number-input--error');
    isValid = false;
  }

  if (!rawBreak || Number.isNaN(breakValue) || breakValue < 1 || breakValue > 999) {
    breakErrorEl.textContent = 'Break duration must be a number between 1 and 999 minutes.';
    breakInput.classList.add('settings-number-input--error');
    isValid = false;
  }

  return isValid;
}

function openSettings() {
  isSettingsOpen = true;
  settingsPopover.setAttribute('aria-hidden', 'false');
  settingsBtn.setAttribute('aria-expanded', 'true');
  // Keep popover aligned right with the Settings button (clear any inline position overrides)
  settingsPopover.style.removeProperty('left');
  settingsPopover.style.removeProperty('top');
  syncSettingsInputsFromState();
  clearSettingsErrors();
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

  const workMinutes = clampMinutes(rawWork, 1, 999);
  const breakMinutes = clampMinutes(rawBreak, 1, 999);

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
  clearSettingsErrors();
  closeSettings();
});

settingsSaveBtn.addEventListener('click', () => {
  if (!validateSettingsInputs()) {
    return;
  }
  applySettings();
  closeSettings();
});

settingsCloseBtn.addEventListener('click', () => {
  closeSettings();
});

workInput.addEventListener('input', () => {
  if (isSettingsValueValid(workInput.value, 1, 999)) {
    workErrorEl.textContent = '';
    workInput.classList.remove('settings-number-input--error');
  }
});

breakInput.addEventListener('input', () => {
  if (isSettingsValueValid(breakInput.value, 1, 999)) {
    breakErrorEl.textContent = '';
    breakInput.classList.remove('settings-number-input--error');
  }
});

workDecreaseBtn.addEventListener('click', () => {
  stepInput(workInput, -1, 1, 999);
  workErrorEl.textContent = '';
  workInput.classList.remove('settings-number-input--error');
});

workIncreaseBtn.addEventListener('click', () => {
  stepInput(workInput, 1, 1, 999);
  workErrorEl.textContent = '';
  workInput.classList.remove('settings-number-input--error');
});

breakDecreaseBtn.addEventListener('click', () => {
  stepInput(breakInput, -1, 1, 999);
  breakErrorEl.textContent = '';
  breakInput.classList.remove('settings-number-input--error');
});

breakIncreaseBtn.addEventListener('click', () => {
  stepInput(breakInput, 1, 1, 999);
  breakErrorEl.textContent = '';
  breakInput.classList.remove('settings-number-input--error');
});

workResetBtn.addEventListener('click', () => {
  workInput.value = String(DEFAULT_WORK_MIN);
  workErrorEl.textContent = '';
  workInput.classList.remove('settings-number-input--error');
});

breakResetBtn.addEventListener('click', () => {
  breakInput.value = String(DEFAULT_BREAK_MIN);
  breakErrorEl.textContent = '';
  breakInput.classList.remove('settings-number-input--error');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isSettingsOpen) {
    closeSettings();
  }
});

render();
