import { kanjiNotes, words } from './data.js';
import { setupKanjiBrowser } from './browser.js';
import { curriculumGrades } from './curriculum.js';
import {
  chooseWord, freshProgress, markMemorized, maxNewPerDay, nextStudyTime, parseProgress, reactivate,
  startOfDay, submitWord, validNewPerDay,
} from './study.js';

const storageKey = 'kanji-practice.progress';
const byId = id => document.getElementById(id);
const labels = { correct: 'Correct', incorrect: 'Incorrect', memorized: 'Memorized' };
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const studyableCharacters = new Set(words.flatMap(word => word.characters));
let progress = freshProgress();
let storedProgress;
let storageReadable = true;
let current;
let wakeTimer;
let submitting = false;
let view = 'menu';
const selections = new Map();

function message(id, text) {
  const element = byId(id);
  element.textContent = text;
  element.hidden = !text;
}

function loadProgress() {
  try {
    storedProgress = localStorage.getItem(storageKey);
    progress = storedProgress === null ? freshProgress() : parseProgress(storedProgress);
    storageReadable = true;
    message('status', '');
  } catch {
    storageReadable = false;
    message('status', 'Saved progress could not be read. Restore a valid backup to continue.');
  }
}

async function save(next) {
  const expected = storedProgress;
  const write = () => {
    if (localStorage.getItem(storageKey) !== expected) return false;
    const raw = JSON.stringify(next);
    localStorage.setItem(storageKey, raw);
    storedProgress = raw;
    progress = next;
    storageReadable = true;
    message('status', '');
    updateStats();
    return true;
  };
  try {
    const saved = navigator.locks ? await navigator.locks.request(storageKey, write) : write();
    if (saved) return true;
    loadProgress();
    showWord();
    message('status', 'Progress changed in another window. The study prompt has been refreshed.');
  } catch {
    message('status', 'Progress could not be saved. Check that browser storage is available, then retry.');
  }
  return false;
}

function updateStats() {
  const now = Date.now();
  const startOfToday = startOfDay(now);
  const states = [...curriculumGrades.keys()].filter(character => progress.characters[character]);
  const introduced = states.filter(character => !progress.characters[character].browserOnly).length;
  const due = states.filter(character => {
    const state = progress.characters[character];
    return studyableCharacters.has(character) && !state.memorized && state.due <= now;
  }).length;
  const memorized = states.filter(character => progress.characters[character].memorized).length;
  byId('introduced').textContent = introduced;
  byId('menu-due').textContent = due;
  byId('due').textContent = due;
  byId('menu-memorized').textContent = memorized;
  byId('memorized').textContent = memorized;
  byId('today').textContent = progress.reviews.filter(review => review.at >= startOfToday && review.at <= now).length;
  byId('coverage').textContent = `${introduced} of ${curriculumGrades.size.toLocaleString()} kanji introduced.`;
}

function showWord(focus = false) {
  clearTimeout(wakeTimer);
  updateStats();
  selections.clear();
  byId('answer').hidden = true;
  byId('spelling').textContent = '';
  byId('characters').replaceChildren();
  byId('next').disabled = true;
  if (view !== 'study') {
    current = null;
    return;
  }
  const now = Date.now();
  current = storageReadable ? chooseWord(words, progress, now) : null;
  byId('show-answer').hidden = !current;
  byId('prompt-label').hidden = !current;
  byId('instruction').hidden = !current;
  const reading = byId('reading');
  if (current) {
    reading.lang = 'ja';
    reading.textContent = current.word.reading;
    byId('meaning').textContent = current.word.meaning;
  } else {
    reading.removeAttribute('lang');
    const earliest = nextStudyTime(words, progress, now);
    const hasUnseen = [...studyableCharacters].some(character => !progress.characters[character]);
    reading.textContent = storageReadable ? 'You’re caught up' : 'Progress unavailable';
    byId('meaning').textContent = !storageReadable ? 'Open Progress to restore a backup.' :
      Number.isFinite(earliest) ? `Next study session available ${dateFormat.format(earliest)}` :
      hasUnseen ? 'Increase the daily new kanji limit in Progress to start new material.' :
      'You’ve completed the vocabulary currently available for study.';
    if (storageReadable && Number.isFinite(earliest)) {
      wakeTimer = setTimeout(showWord, Math.max(100, Math.min(2_147_483_647, earliest - Date.now())));
    }
  }
  if (focus) reading.focus();
}

function navigate(nextView) {
  view = nextView;
  for (const name of ['menu', 'study', 'browser']) byId(`${name}-view`).hidden = name !== view;
  clearTimeout(wakeTimer);
  window.scrollTo(0, 0);
  updateStats();
  if (view === 'menu') byId('menu-title').focus({ preventScroll: true });
  if (view === 'study') {
    if (!selections.size) showWord(true);
    else byId('spelling').focus();
  }
  if (view === 'browser') browser.open();
}

function refreshAfterStatusChange(character) {
  if (!selections.size || current?.targets.includes(character)) {
    const hadSelections = selections.size > 0;
    showWord();
    if (hadSelections) message('status', 'The draft was discarded because a kanji in that review changed status.');
  }
}

const browser = setupKanjiBrowser(() => progress, () => storageReadable, async (character, memorized) => {
  const next = memorized ? markMemorized(progress, character) : reactivate(progress, character);
  if (!await save(next)) return false;
  refreshAfterStatusChange(character);
  return true;
});

byId('start-study').addEventListener('click', () => navigate('study'));
byId('open-browser').addEventListener('click', () => navigate('browser'));
for (const button of document.querySelectorAll('.return-menu')) {
  button.addEventListener('click', () => {
    button.closest('dialog')?.close();
    navigate('menu');
  });
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderCharacter(character) {
  const card = node('section', '', 'character');
  const header = node('div', '', 'character-head');
  const glyph = node('span', character, 'glyph');
  glyph.lang = 'ja';
  const isTarget = current.targets.includes(character);
  const status = node('span', isTarget ? (progress.characters[character] ? 'Due for review' : 'New kanji') :
    progress.characters[character]?.memorized ? 'Memorized' : 'Not scheduled for this word', 'character-status');
  status.setAttribute('aria-live', 'polite');
  header.append(glyph, status);
  card.append(header);
  if (isTarget) {
    const controls = node('div', '', 'grades');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', `Grade ${character}`);
    for (const [outcome, label] of Object.entries(labels)) {
      const button = node('button', label);
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        if (submitting) return;
        selections.set(character, outcome);
        for (const choice of controls.children) choice.setAttribute('aria-pressed', String(choice === button));
        status.textContent = `${label} selected`;
        byId('next').disabled = selections.size !== current.targets.length;
      });
      controls.append(button);
    }
    card.append(controls);
  }
  const notes = kanjiNotes[character];
  if (notes) {
    const [components, structure, mnemonic] = notes;
    const breakdown = node('details', '');
    breakdown.append(node('summary', 'Kanji Breakdown'), node('p', components), node('p', structure));
    if (mnemonic) breakdown.append(node('p', `Memory aid · ${mnemonic}`));
    card.append(breakdown);
  }
  return card;
}

byId('show-answer').addEventListener('click', () => {
  byId('spelling').textContent = current.word.spelling;
  byId('characters').replaceChildren(...current.word.characters.map(renderCharacter));
  byId('answer').hidden = false;
  byId('show-answer').hidden = true;
  byId('instruction').hidden = true;
  byId('spelling').focus();
});

byId('next').addEventListener('click', async () => {
  if (submitting || selections.size !== current?.targets.length) return;
  submitting = true;
  byId('next').disabled = true;
  try {
    if (await save(submitWord(progress, current, selections))) showWord(true);
  } catch {
    showWord();
    message('status', 'This word is no longer eligible. The study prompt has been refreshed.');
  } finally {
    submitting = false;
    byId('next').disabled = selections.size !== current?.targets.length;
  }
});

function renderMemorized() {
  const list = byId('memorized-list');
  list.replaceChildren();
  for (const character of curriculumGrades.keys()) {
    if (!progress.characters[character]?.memorized) continue;
    const row = node('div', '', 'entry');
    const glyph = node('span', character, 'glyph');
    glyph.lang = 'ja';
    const button = node('button', 'Reactivate');
    button.type = 'button';
    button.setAttribute('aria-label', `Reactivate ${character}`);
    button.addEventListener('click', async () => {
      if (!await save(reactivate(progress, character))) {
        message('backup-status', 'Progress could not be saved.');
        return;
      }
      refreshAfterStatusChange(character);
      renderMemorized();
      browser.refresh();
      message('backup-status', `${character} was reactivated.`);
    });
    row.append(glyph, button);
    list.append(row);
  }
  if (!list.children.length) list.append(node('p', 'No memorized kanji yet.'));
}

byId('open-progress').addEventListener('click', () => {
  updateStats();
  renderMemorized();
  byId('new-per-day').value = progress.newPerDay;
  byId('new-per-day').max = maxNewPerDay;
  byId('schedule-settings').hidden = !storageReadable;
  byId('export').disabled = !storageReadable;
  message('backup-status', '');
  byId('progress').showModal();
});

byId('schedule-settings').addEventListener('submit', async event => {
  event.preventDefault();
  const limit = byId('new-per-day').valueAsNumber;
  if (!validNewPerDay(limit)) return;
  if (await save({ ...progress, newPerDay: limit })) {
    showWord();
    message('backup-status', 'Daily limit saved.');
  }
});

byId('export').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' }));
  const link = node('a', '');
  link.href = url;
  link.download = `kanji-practice-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
});

byId('import').addEventListener('click', () => byId('backup-file').click());
byId('backup-file').addEventListener('change', async event => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    const backup = parseProgress(await file.text());
    if (!confirm('Replace the progress on this device with this backup?')) return;
    if (!await save(backup)) {
      message('backup-status', 'The backup could not be saved.');
      return;
    }
    showWord();
    renderMemorized();
    if (view === 'browser') browser.refresh();
    byId('new-per-day').value = progress.newPerDay;
    byId('schedule-settings').hidden = false;
    byId('export').disabled = false;
    message('backup-status', 'Backup restored.');
  } catch {
    message('backup-status', 'This file is not a valid Kanji Practice backup.');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (view === 'study' && !current) showWord();
  else updateStats();
});

window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  loadProgress();
  showWord();
  if (view === 'browser') browser.refresh();
  if (byId('progress').open) {
    renderMemorized();
    byId('new-per-day').value = progress.newPerDay;
    byId('schedule-settings').hidden = !storageReadable;
    byId('export').disabled = !storageReadable;
  }
});

loadProgress();
showWord();
if ('serviceWorker' in navigator) {
  const offlineReady = () => { byId('offline').hidden = !navigator.serviceWorker.controller; };
  navigator.serviceWorker.addEventListener('controllerchange', offlineReady);
  navigator.serviceWorker.register('./sw.js').then(offlineReady).catch(error => {
    console.warn('Offline installation failed', error);
  });
}
