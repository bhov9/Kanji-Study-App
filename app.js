import { kanjiNotes, words } from './data.js';
import { setupKanjiBrowser } from './browser.js';
import { curriculumGrades, groups } from './curriculum.js';
import { exampleFor, renderExample } from './examples.js';
import { setupHandwriting } from './handwriting.js';
import { kanjiReference } from './kanji-reference.js';
import {
  chooseWord, freshProgress, markMemorized, maxNewPerDay, parseProgress, reactivate,
  startOfDay, submitWord, validNewPerDay,
} from './study.js';

const storageKey = 'kanji-practice.progress';
const byId = id => document.getElementById(id);
const labels = { correct: 'Correct', incorrect: 'Incorrect', memorized: 'Memorized' };
const memorizedPercent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 2 });
const studyableCharacters = new Set(words.flatMap(word => word.characters));
let progress = freshProgress();
let storedProgress;
let storageReadable = true;
let current;
let submitting = false;
let view = 'menu';
const selections = new Map();
const handwriting = setupHandwriting();

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
  if (byId('progress').open) renderGradeProgress();
}

function showWord(focus = false) {
  updateStats();
  selections.clear();
  byId('answer').hidden = true;
  byId('spelling').textContent = '';
  byId('characters').replaceChildren();
  byId('word-example').hidden = true;
  byId('next').disabled = true;
  if (view !== 'study') {
    current = null;
    handwriting.reset([]);
    return;
  }
  const now = Date.now();
  current = storageReadable ? chooseWord(words, progress, now) : null;
  handwriting.reset(current?.targets ?? []);
  byId('show-answer').hidden = !current;
  byId('prompt-label').hidden = !current;
  byId('instruction').hidden = !current;
  const reading = byId('reading');
  if (current) {
    byId('prompt-label').textContent = current.practice ? 'Extra practice · FSRS dates stay the same' : 'Write from memory';
    reading.lang = 'ja';
    reading.textContent = current.word.reading;
    byId('meaning').textContent = current.word.meaning;
    renderExample(byId('word-example'), exampleFor(current.word.id), current.word, false);
  } else {
    reading.removeAttribute('lang');
    reading.textContent = storageReadable ? 'No vocabulary available' : 'Progress unavailable';
    byId('meaning').textContent = storageReadable ? '' : 'Open Progress to restore a backup.';
  }
  if (focus) reading.focus();
}

function navigate(nextView) {
  view = nextView;
  for (const name of ['menu', 'study', 'browser']) byId(`${name}-view`).hidden = name !== view;
  window.scrollTo(0, 0);
  updateStats();
  if (view === 'menu') byId('menu-title').focus({ preventScroll: true });
  if (view === 'study') {
    if (!selections.size && !handwriting.hasDraft()) showWord(true);
    else byId(byId('answer').hidden ? 'reading' : 'spelling').focus();
  }
  if (view === 'browser') browser.open();
}

function refreshAfterStatusChange(character) {
  if ((!selections.size && !handwriting.hasDraft()) || current?.targets.includes(character)) {
    const hadDraft = selections.size > 0 || handwriting.hasDraft();
    showWord();
    if (hadDraft) message('status', 'The draft was discarded because a kanji in that review changed status.');
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

function renderKanjiDetails(character) {
  const details = node('details', '', 'study-kanji-details');
  details.append(node('summary', 'Kanji Details'));
  const glyph = node('p', character, 'glyph');
  glyph.lang = 'ja';
  details.append(glyph);
  const grade = curriculumGrades.get(character);
  const reference = kanjiReference[character];
  const [components, structure, mnemonic] = kanjiNotes[character] ?? [];
  const field = (heading, value, lang) => {
    if (!value) return;
    const text = node('p', value);
    if (lang) text.lang = lang;
    details.append(node('h4', heading), text);
  };
  if (grade) {
    const gradeHeading = node('h4', 'School Grade');
    const gradeName = node('p', '');
    const japanese = node('span', grade < 7 ? `小学${grade}年生` : '中学校以降');
    japanese.lang = 'ja';
    gradeName.append(japanese, grade < 7 ? ` / Grade ${grade}` : ' / Secondary School / Remaining Jōyō');
    details.append(gradeHeading, gradeName);
  }
  field('Meaning', reference?.meanings.join('; '));
  field('On’yomi', reference?.on.join('、'), 'ja');
  field('Kun’yomi', reference?.kun.map(reading => reading.replace(/\.(.+)$/, '（$1）')).join('、'), 'ja');
  field('Components', components);
  if (structure) details.append(node('p', structure));
  field('Mnemonic', mnemonic);
  return details;
}

function renderCharacter(character, writingBox) {
  const card = node('section', '', 'character');
  const header = node('div', '', 'character-head');
  const glyph = node('span', character, 'glyph');
  glyph.lang = 'ja';
  const isTarget = current.targets.includes(character);
  const status = node('span', isTarget ? (current.practice ? 'Extra practice' :
    progress.characters[character] ? 'Due for review' : 'New kanji') :
    progress.characters[character]?.memorized ? 'Memorized' : 'Not scheduled for this word', 'character-status');
  status.setAttribute('aria-live', 'polite');
  header.append(glyph, status);
  card.append(header);
  if (writingBox) {
    const comparison = node('div', '', 'writing-comparison');
    const correct = node('div', '', 'writing-correct');
    const model = node('span', character, 'glyph');
    model.lang = 'ja';
    correct.append(node('span', 'Answer'), model);
    comparison.append(writingBox, correct);
    card.append(comparison);
  }
  if (isTarget) {
    const controls = node('div', '', 'grades');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', `Grade ${character}`);
    for (const [outcome, label] of Object.entries(labels)) {
      const button = node('button', label);
      button.type = 'button';
      const check = node('span', '✓', 'grade-check');
      check.setAttribute('aria-hidden', 'true');
      button.prepend(check);
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
  card.append(renderKanjiDetails(character));
  return card;
}

function revealAnswer() {
  if (!current || !byId('answer').hidden) return;
  const writingBoxes = handwriting.reveal();
  byId('spelling').textContent = current.word.spelling;
  byId('characters').replaceChildren(...current.word.characters.map(character =>
    renderCharacter(character, writingBoxes.get(character))));
  byId('answer').hidden = false;
  renderExample(byId('word-example'), exampleFor(current.word.id), current.word, true);
  byId('show-answer').hidden = true;
  byId('instruction').hidden = true;
  byId('spelling').focus();
}

byId('show-answer').addEventListener('click', revealAnswer);
byId('check-writing').addEventListener('click', revealAnswer);

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

function renderGradeProgress() {
  byId('grade-progress').replaceChildren(...groups.map(({ grade, label, characters }) => {
    const total = characters.length;
    const memorized = characters.filter(character => progress.characters[character]?.memorized === true).length;
    const name = grade === 7 ? 'Secondary School / Remaining Jōyō' : label;
    const row = node('div', '', 'grade-progress-row');
    const heading = node('h4', name);
    const meter = node('div', '', 'grade-progress-meter');
    const bar = node('progress', '');
    bar.max = total;
    bar.value = memorized;
    bar.setAttribute('aria-label', `${name}: ${memorized} of ${total} kanji memorized`);
    meter.append(bar, node('span', memorizedPercent.format(memorized / total)));
    row.append(heading, meter, node('p', `${memorized.toLocaleString()} / ${total.toLocaleString()} kanji memorized`));
    return row;
  }));
}

byId('open-progress').addEventListener('click', () => {
  updateStats();
  renderGradeProgress();
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
    if (!handwriting.hasDraft() && !selections.size) showWord();
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
