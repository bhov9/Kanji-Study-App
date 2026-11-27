import { setupVocabulary } from './vocabulary.js';
import { sectionPlans } from './section-plans.js';
import { kanjiNotes, words, writingPriority } from './data.js';
import { setupKanjiBrowser } from './browser.js';
import { curriculumGrades, groups } from './curriculum.js';
import { exampleFor, renderExample } from './examples.js';
import { characterFeedback, feedbackForm, readFeedback, setupFeedbackSummary, validateFeedback, withRestoredFeedback } from './feedback.js';
import { setupHandwriting } from './handwriting.js';
import { createGuidedPractice } from './guided-practice.js';
import { kanjiReference } from './kanji-reference.js';
import { readingCue } from './reading-cue.js';
import { appendDictionaryReadings } from './dictionary-readings.js';
import { createStrokeOrder } from './stroke-order.js';
import { setupProgressEditor } from './progress-editor.js';
import {
  applyMemorization, chooseWord, freshProgress, isDue, lastGradeLabel, markMemorized, minimumIncorrectSeparation,
  parseProgress, reactivate, startOfDay, submitWord, unlockedGrade,
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
const renderFeedbackSummary = setupFeedbackSummary();

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

async function save(next, feedback) {
  const expected = storedProgress;
  const write = () => {
    if (localStorage.getItem(storageKey) !== expected) return false;
    const raw = JSON.stringify(next);
    withRestoredFeedback(feedback, () => localStorage.setItem(storageKey, raw));
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
  byId('open-progress-editor').disabled = !storageReadable;
  const now = Date.now();
  const startOfToday = startOfDay(now);
  const states = [...curriculumGrades.keys()].filter(character => progress.characters[character]);
  const introduced = states.filter(character => !progress.characters[character].browserOnly).length;
  const due = states.filter(character => {
    const state = progress.characters[character];
    return studyableCharacters.has(character) && isDue(state, now);
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
  message('tested-positions', '');
  byId('next').disabled = true;
  if (view !== 'study') {
    current = null;
    handwriting.reset([]);
    return;
  }
  const now = Date.now();
  current = storageReadable ? chooseWord(words, progress, now, Math.random, writingPriority) : null;
  handwriting.reset(current?.targets ?? []);
  byId('show-answer').hidden = !current;
  byId('check-reviews').hidden = Boolean(current || !storageReadable);
  byId('prompt-label').hidden = !current;
  byId('instruction').hidden = !current;
  const reading = byId('reading');
  if (current) {
    reading.lang = 'ja';
    const cue = readingCue(current.word, current.targets);
    reading.replaceChildren(...cue.parts.map(({ text, tested }) =>
      tested ? node('u', text) : document.createTextNode(text)));
    message('tested-positions', cue.hint);
    byId('meaning').textContent = current.word.meaning;
    renderExample(byId('word-example'), exampleFor(current.word.id), current.word, false);
  } else {
    reading.removeAttribute('lang');
    reading.textContent = storageReadable ? 'No kanji ready for review' : 'Progress unavailable';
    const waiting = Object.values(progress.characters).some(state =>
      !state.memorized && state.lastGrade === 'incorrect' && state.due === null);
    byId('meaning').textContent = storageReadable
      ? (waiting ? `Missed kanji need ${minimumIncorrectSeparation} other distinct kanji graded before they can return.` :
        'Return later for scheduled reviews.')
      : 'Open Progress to restore a backup.';
  }
  if (focus) reading.focus();
}

function navigate(nextView) {
  view = nextView;
  for (const name of ['menu', 'section', 'study', 'browser', 'history', 'sources', 'feedback']) byId(`${name}-view`).hidden = name !== view;
  window.scrollTo(0, 0);
  updateStats();
  if (view === 'menu') byId('menu-title').focus({ preventScroll: true });
  if (view === 'study') {
    if (!selections.size && !handwriting.hasDraft()) showWord(true);
    else byId(byId('answer').hidden ? 'reading' : 'spelling').focus();
  }
  if (view === 'browser') browser.open();
  if (view === 'history') byId('history-title').focus({ preventScroll: true });
  if (view === 'sources') byId('sources-title').focus({ preventScroll: true });
  if (view === 'feedback') {
    renderFeedbackSummary();
    byId('feedback-title').focus({ preventScroll: true });
  }
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

setupProgressEditor(() => progress, () => storageReadable, async changes => {
  const next = applyMemorization(progress, changes);
  if (!await save(next)) return false;
  const grade = unlockedGrade(next.characters);
  const invalidated = current?.targets.some(character => changes.has(character) ||
    (!next.characters[character] && curriculumGrades.get(character) !== grade));
  if ((!selections.size && !handwriting.hasDraft()) || invalidated) {
    showWord();
  }
  browser.refresh();
  return true;
});

const openVocabulary = setupVocabulary(browser.openDetails);
function openSection(section) {
  navigate('section');
  byId('section-title').textContent = section;
  byId('kanji-section').hidden = section !== 'Kanji';
  byId('vocabulary-section').hidden = section !== 'Vocabulary';
  const placeholder = byId('section-placeholder');
  placeholder.hidden = section === 'Kanji' || section === 'Vocabulary';
  placeholder.textContent = placeholder.hidden ? '' : 'Reviewed lessons are planned for this section.';
  const items = sectionPlans[section] ?? [];
  byId('section-plan').hidden = !items.length;
  byId('plan-title').textContent = section + ' plan';
  byId('plan-items').replaceChildren(...items.map(item => node('li', item)));
  if (section === 'Vocabulary') openVocabulary();
  byId('section-title').focus();
}
document.querySelectorAll('[data-section]').forEach(button =>
  button.addEventListener('click', () => openSection(button.dataset.section)));
byId('section-plan').onclick = () => byId('plan-dialog').showModal();
byId('section-progress').onclick = () => byId('open-progress').click();
byId('start-study').addEventListener('click', () => navigate('study'));
byId('check-reviews').addEventListener('click', () => showWord(true));
function studyFeedbackContext(character) {
  return { page: 'Writing Screen', character, word: current?.word.spelling, reading: current?.word.reading };
}
byId('open-feedback').addEventListener('click', () => {
  byId('study-feedback-form').replaceChildren(feedbackForm(studyFeedbackContext()));
  byId('study-feedback').showModal();
});
byId('open-feedback-summary').addEventListener('click', () => navigate('feedback'));
byId('open-browser').addEventListener('click', () => navigate('browser'));
byId('open-history').addEventListener('click', () => navigate('history'));
for (const button of document.querySelectorAll('.open-sources')) {
  button.addEventListener('click', () => navigate('sources'));
}
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
  appendDictionaryReadings(details, reference, 'h4', character);
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
  const status = node('span', isTarget ? (progress.characters[character] ? 'Due for review' : 'New kanji') :
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
    card.append(node('p', `Last Grade: ${lastGradeLabel(progress.characters[character])}`, 'last-grade'), controls);
    card.append(createGuidedPractice(character), createStrokeOrder(character));
  }
  card.append(renderKanjiDetails(character), characterFeedback(studyFeedbackContext(character)));
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
    if (await save(submitWord(progress, current, selections))) {
      showWord(true);
    }
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
  byId('export').disabled = !storageReadable;
  message('backup-status', '');
  byId('progress').showModal();
});

byId('export').addEventListener('click', () => {
  let backup;
  try {
    backup = { ...progress, feedback: readFeedback() };
  } catch {
    message('backup-status', 'Saved feedback could not be read. No backup was exported.');
    return;
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
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
    const { feedback, ...data } = JSON.parse(await file.text());
    const backup = parseProgress(JSON.stringify(data));
    const entries = feedback === undefined ? undefined : validateFeedback(feedback);
    const target = entries === undefined ? 'progress' : 'progress and feedback';
    if (!confirm(`Replace the ${target} on this device with this backup?`)) return;
    if (!await save(backup, entries)) {
      message('backup-status', 'The backup could not be saved.');
      return;
    }
    showWord();
    if (view === 'browser') browser.refresh();
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
