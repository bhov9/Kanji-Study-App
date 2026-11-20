import { kanji, words } from './data.js';
import { chooseWord, freshProgress, parseProgress, reactivate, record } from './study.js';

const storageKey = 'kanji-practice.progress';
const byId = id => document.getElementById(id);
const labels = { correct: 'Correct', incorrect: 'Incorrect', memorized: 'Memorized' };
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
let progress = freshProgress();
let storageReadable = true;
let current;
let previousId;
let wakeTimer;
const graded = new Set();

function message(id, text) {
  const element = byId(id);
  element.textContent = text;
  element.hidden = !text;
}

try {
  const raw = localStorage.getItem(storageKey);
  if (raw !== null) progress = parseProgress(raw);
} catch {
  storageReadable = false;
  message('status', 'Saved progress could not be read. Restore a valid backup to continue.');
}

function save(next) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    message('status', 'Progress could not be saved. Check that browser storage is available, then retry.');
    return false;
  }
  progress = next;
  storageReadable = true;
  message('status', '');
  updateStats();
  return true;
}

function updateStats() {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const states = Object.keys(kanji).map(character => progress.characters[character]).filter(Boolean);
  byId('due').textContent = states.filter(state => !state.memorized && state.due <= now).length;
  byId('today').textContent = progress.reviews.filter(review => review.at >= startOfToday.getTime() && review.at <= now).length;
  byId('memorized').textContent = states.filter(state => state.memorized).length;
  byId('coverage').textContent = `${states.length} of ${Object.keys(kanji).length} kanji introduced across ${words.length} words.`;
}

function showWord(focus = false) {
  clearTimeout(wakeTimer);
  updateStats();
  graded.clear();
  byId('answer').hidden = true;
  byId('spelling').textContent = '';
  byId('characters').replaceChildren();
  byId('next').disabled = true;
  current = storageReadable ? chooseWord(words, progress, Date.now(), previousId) : null;
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
    const upcoming = Object.keys(kanji).map(character => progress.characters[character])
      .filter(state => state && !state.memorized).map(state => state.due);
    const earliest = Math.min(...upcoming);
    reading.textContent = storageReadable ? 'You’re caught up' : 'Progress unavailable';
    byId('meaning').textContent = !storageReadable ? 'Open Progress to restore a backup.' :
      Number.isFinite(earliest) ? `Next review ${dateFormat.format(earliest)}` : 'Reactivate a kanji from Progress to study it again.';
    if (storageReadable && Number.isFinite(earliest)) {
      wakeTimer = setTimeout(showWord, Math.max(100, Math.min(2_147_483_647, earliest - Date.now())));
    }
  }
  if (focus) reading.focus();
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
  const [, components, structure, mnemonic] = kanji[character];
  const status = node('span', isTarget ? (progress.characters[character] ? 'Due for review' : 'New kanji') :
    progress.characters[character]?.memorized ? 'Memorized' : 'Scheduled for later', 'character-status');
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
        if (graded.has(character) || !save(record(progress, current.word, character, outcome))) return;
        graded.add(character);
        button.setAttribute('aria-pressed', 'true');
        for (const choice of controls.children) choice.disabled = true;
        status.textContent = outcome === 'memorized' ? 'Memorized' :
          `${label} · ${dateFormat.format(progress.characters[character].due)}`;
        byId('next').disabled = graded.size !== current.targets.length;
        if (!byId('next').disabled) byId('next').focus({ preventScroll: true });
      });
      controls.append(button);
    }
    card.append(controls);
  }
  const breakdown = node('details', '');
  breakdown.append(node('summary', 'Kanji Breakdown'), node('p', components), node('p', structure));
  if (mnemonic) breakdown.append(node('p', `Memory aid · ${mnemonic}`));
  card.append(breakdown);
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

byId('next').addEventListener('click', () => {
  previousId = current.word.id;
  showWord(true);
});

function renderMemorized() {
  const list = byId('memorized-list');
  list.replaceChildren();
  for (const character of Object.keys(kanji)) {
    if (!progress.characters[character]?.memorized) continue;
    const row = node('div', '', 'entry');
    const glyph = node('span', character, 'glyph');
    glyph.lang = 'ja';
    const button = node('button', 'Reactivate');
    button.type = 'button';
    button.setAttribute('aria-label', `Reactivate ${character}`);
    button.addEventListener('click', () => {
      if (!save(reactivate(progress, character))) {
        message('backup-status', 'Progress could not be saved.');
        return;
      }
      showWord();
      renderMemorized();
      message('backup-status', `${character} is available for review.`);
    });
    row.append(glyph, button);
    list.append(row);
  }
  if (!list.children.length) list.append(node('p', 'No memorized kanji yet.'));
}

byId('open-progress').addEventListener('click', () => {
  updateStats();
  renderMemorized();
  byId('export').disabled = !storageReadable;
  message('backup-status', '');
  byId('progress').showModal();
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
    if (!save(backup)) {
      message('backup-status', 'The backup could not be saved.');
      return;
    }
    showWord();
    renderMemorized();
    byId('export').disabled = false;
    message('backup-status', 'Backup restored.');
  } catch {
    message('backup-status', 'This file is not a valid Kanji Practice backup.');
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (!current) showWord();
  else updateStats();
});

window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  try {
    const raw = localStorage.getItem(storageKey);
    progress = raw === null ? freshProgress() : parseProgress(raw);
    storageReadable = true;
    message('status', '');
  } catch {
    storageReadable = false;
    message('status', 'Saved progress could not be read. Restore a valid backup to continue.');
  }
  showWord();
  if (byId('progress').open) {
    renderMemorized();
    byId('export').disabled = !storageReadable;
  }
});

showWord();
if ('serviceWorker' in navigator) {
  const offlineReady = () => { byId('offline').hidden = !navigator.serviceWorker.controller; };
  navigator.serviceWorker.addEventListener('controllerchange', offlineReady);
  navigator.serviceWorker.register('./sw.js').then(offlineReady).catch(error => {
    console.warn('Offline installation failed', error);
  });
}
