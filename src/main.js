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
const themeToggleBtn = document.getElementById('theme-toggle-btn');

let timeRemaining = workDurationSec;
let isRunning = false;
let currentMode = 'work';
let completedPomodoros = 0;
let tickIntervalId = null;
let isSettingsOpen = false;
let audioContext = null;
const POMODORO_STORAGE_KEY = 'pomodoro-completed-count';
const POMODORO_POSITIONS_KEY = 'pomodoro-tomato-positions';
const THEME_STORAGE_KEY = 'pomodoro-theme';

let tomatoPositions = [];

function getAppRelativeRect(element, appRect) {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - appRect.top,
    left: rect.left - appRect.left,
    width: rect.width,
    height: rect.height,
  };
}

function rectsOverlap(a, b, padding = 0) {
  if (!a || !b) return false;
  const aLeft = a.left - padding;
  const aTop = a.top - padding;
  const aRight = a.left + a.width + padding;
  const aBottom = a.top + a.height + padding;

  const bLeft = b.left - padding;
  const bTop = b.top - padding;
  const bRight = b.left + b.width + padding;
  const bBottom = b.top + b.height + padding;

  return !(
    aRight <= bLeft ||
    aLeft >= bRight ||
    aBottom <= bTop ||
    aTop >= bBottom
  );
}

function getForbiddenRects() {
  const appRect = appEl.getBoundingClientRect();
  const timerEl = document.querySelector('main.timer');
  const titleEl = document.querySelector('.app-title');
  const settingsButtonEl = document.getElementById('settings-btn');
  const themeToggleButtonEl = document.getElementById('theme-toggle-btn');

  return {
    appRect,
    rects: [
      getAppRelativeRect(timerEl, appRect),
      getAppRelativeRect(titleEl, appRect),
      getAppRelativeRect(themeToggleButtonEl, appRect),
      getAppRelativeRect(settingsButtonEl, appRect),
    ].filter(Boolean),
  };
}

function ensurePomodoroLayer() {
  let layer = document.getElementById('pomodoro-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'pomodoro-layer';
    layer.setAttribute('aria-hidden', 'true');
    appEl.appendChild(layer);
  }
  return layer;
}

function saveTomatoPositions() {
  try {
    window.localStorage.setItem(
      POMODORO_POSITIONS_KEY,
      JSON.stringify(tomatoPositions)
    );
    window.localStorage.setItem(
      POMODORO_STORAGE_KEY,
      String(tomatoPositions.length)
    );
  } catch (_) {}
}

function getRandomTomatoPosition() {
  const { appRect, rects: forbiddenRects } = getForbiddenRects();
  const size = 16;
  const maxWidth = appRect.width - size;
  const maxHeight = appRect.height - size;
  if (maxWidth <= 0 || maxHeight <= 0) return { top: 0, left: 0 };

  let attempts = 0;
  const maxAttempts = 40;
  let position = { top: Math.random() * maxHeight, left: Math.random() * maxWidth };

  while (attempts < maxAttempts) {
    attempts += 1;
    const left = Math.random() * maxWidth;
    const top = Math.random() * maxHeight;
    const candidateRect = { top, left, width: size, height: size };
    const overlaps = forbiddenRects.some((rect) =>
      rectsOverlap(candidateRect, rect, 4)
    );
    if (!overlaps) {
      position = { top, left };
      break;
    }
    position = { top, left };
  }
  return position;
}

function createTomatoElement(position, index) {
  const tomatoEl = document.createElement('div');
  tomatoEl.className = 'pomodoro-tomato';
  tomatoEl.setAttribute('data-index', String(index));
  tomatoEl.style.top = `${position.top}px`;
  tomatoEl.style.left = `${position.left}px`;
  tomatoEl.setAttribute('aria-label', 'Completed pomodoro');
  return tomatoEl;
}

function makeTomatoDraggable(tomatoEl) {
  const layer = document.getElementById('pomodoro-layer');
  if (!layer) return;

  const size = 16;
  let startClientX = 0;
  let startClientY = 0;
  let startTop = 0;
  let startLeft = 0;

  function getClientCoords(e) {
    if (e.touches && e.touches.length) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  }

  function onPointerDown(e) {
    e.preventDefault();
    const coords = e.touches ? getClientCoords(e) : { clientX: e.clientX, clientY: e.clientY };
    startClientX = coords.clientX;
    startClientY = coords.clientY;
    startTop = parseFloat(tomatoEl.style.top) || 0;
    startLeft = parseFloat(tomatoEl.style.left) || 0;
    tomatoEl.classList.add('pomodoro-tomato--dragging');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  function onMove(e) {
    e.preventDefault();
    const coords = e.touches ? getClientCoords(e) : { clientX: e.clientX, clientY: e.clientY };
    const deltaX = coords.clientX - startClientX;
    const deltaY = coords.clientY - startClientY;
    tomatoEl.style.left = `${startLeft + deltaX}px`;
    tomatoEl.style.top = `${startTop + deltaY}px`;
  }

  function onUp(e) {
    if (e.type === 'touchend') {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    } else {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    tomatoEl.classList.remove('pomodoro-tomato--dragging');

    const layerRect = layer.getBoundingClientRect();
    const elRect = tomatoEl.getBoundingClientRect();
    let top = elRect.top - layerRect.top;
    let left = elRect.left - layerRect.left;
    const maxTop = Math.max(0, layerRect.height - size);
    const maxLeft = Math.max(0, layerRect.width - size);
    top = Math.min(Math.max(0, top), maxTop);
    left = Math.min(Math.max(0, left), maxLeft);
    tomatoEl.style.top = `${top}px`;
    tomatoEl.style.left = `${left}px`;

    const index = parseInt(tomatoEl.getAttribute('data-index'), 10);
    if (!Number.isNaN(index) && index >= 0 && index < tomatoPositions.length) {
      tomatoPositions[index] = { top, left };
      saveTomatoPositions();
    }
  }

  tomatoEl.addEventListener('mousedown', onPointerDown);
  tomatoEl.addEventListener('touchstart', onPointerDown, { passive: false });
}

function placeTomatoIcon(optionalPosition) {
  const layer = ensurePomodoroLayer();
  const appRect = appEl.getBoundingClientRect();
  const size = 16;
  if (appRect.width < size || appRect.height < size) return;

  const position = optionalPosition != null
    ? optionalPosition
    : getRandomTomatoPosition();
  const index = tomatoPositions.length;
  tomatoPositions.push(position);
  saveTomatoPositions();

  const tomatoEl = createTomatoElement(position, index);
  makeTomatoDraggable(tomatoEl);
  layer.appendChild(tomatoEl);
}

function loadCompletedPomodoros() {
  try {
    const positionsStored = window.localStorage.getItem(POMODORO_POSITIONS_KEY);
    if (positionsStored) {
      const parsed = JSON.parse(positionsStored);
      if (Array.isArray(parsed)) {
        tomatoPositions = parsed.filter(
          (p) => p && typeof p.top === 'number' && typeof p.left === 'number'
        );
        const layer = ensurePomodoroLayer();
        const appRect = appEl.getBoundingClientRect();
        const size = 16;
        const maxTop = Math.max(0, appRect.height - size);
        const maxLeft = Math.max(0, appRect.width - size);
        tomatoPositions.forEach((pos, i) => {
          const top = Math.min(Math.max(0, pos.top), maxTop);
          const left = Math.min(Math.max(0, pos.left), maxLeft);
          tomatoPositions[i] = { top, left };
          const tomatoEl = createTomatoElement({ top, left }, i);
          makeTomatoDraggable(tomatoEl);
          layer.appendChild(tomatoEl);
        });
        completedPomodoros = tomatoPositions.length;
        return;
      }
    }
    const countStored = window.localStorage.getItem(POMODORO_STORAGE_KEY);
    if (countStored) {
      const parsed = Number(countStored);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        completedPomodoros = parsed;
        tomatoPositions = [];
        const layer = ensurePomodoroLayer();
        for (let i = 0; i < completedPomodoros; i += 1) {
          const position = getRandomTomatoPosition();
          tomatoPositions.push(position);
          const tomatoEl = createTomatoElement(position, i);
          makeTomatoDraggable(tomatoEl);
          layer.appendChild(tomatoEl);
        }
        saveTomatoPositions();
      }
    }
  } catch (_) {
    // Ignore storage failures
  }
}

function recordCompletedPomodoro() {
  const position = getRandomTomatoPosition();
  placeTomatoIcon(position);
  completedPomodoros = tomatoPositions.length;
}

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
    const finishedMode = currentMode;
    currentMode = currentMode === 'work' ? 'break' : 'work';
    if (finishedMode === 'work') {
      recordCompletedPomodoro();
    }
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

function getStoredTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) {}
  return 'dark';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (_) {}
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    themeToggleBtn.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}

if (themeToggleBtn) {
  applyTheme(getStoredTheme());
  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });
}

loadCompletedPomodoros();
render();
