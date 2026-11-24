import assert from 'node:assert/strict';
import test from 'node:test';
import { curriculumGrades, groups } from '../curriculum.js';
import { words } from '../data.js';
import { applyMemorization, chooseWord, freshProgress, lastGradeLabel, parseProgress, reactivate, submitWord } from '../study.js';

const now = new Date(2026, 10, 20, 12).getTime();
const minute = 60_000;
const day = 1440 * minute;
const first = () => 0;
const last = () => 0.999;
const word = id => words.find(entry => entry.id === id);
const submit = (progress, prompt, at, outcome = 'correct') =>
  submitWord(progress, prompt, new Map(prompt.targets.map(character => [character, outcome])), at);

test('only final grades are saved together, independently per character', () => {
  const progress = freshProgress();
  const prompt = { word: word('kazan'), targets: ['火', '山'] };
  const selections = new Map([['火', 'memorized'], ['山', 'incorrect']]);
  selections.set('火', 'incorrect');
  selections.set('火', 'correct');
  assert.equal(progress.reviews.length, 0);
  const saved = submitWord(progress, prompt, selections, now);
  assert.deepEqual(saved.reviews.map(({ character, outcome }) => [character, outcome]),
    [['火', 'correct'], ['山', 'incorrect']]);
  assert.equal(saved.characters['山'].due, null);
  assert.equal(lastGradeLabel(saved.characters['山']), 'Incorrect');
  assert.equal(saved.characters['火'].due, now + day);
  assert.equal(lastGradeLabel(saved.characters['火']), 'Correct 1');
  assert.throws(() => submitWord(saved, prompt, selections, now));
  assert.deepEqual(parseProgress(JSON.stringify(saved)), saved);
});

test('all correct streak stages use the actual grading time and ready remains manual', () => {
  const prompt = { word: word('kazan'), targets: ['火'] };
  let progress = freshProgress();
  let at = now;
  assert.equal(lastGradeLabel(undefined), 'Not yet graded');
  for (const [index, interval] of [1, 3, 7, 14, 28, 28, 28].entries()) {
    progress = submit(progress, prompt, at);
    const state = progress.characters['火'];
    assert.equal(state.due, at + interval * day);
    assert.equal(state.correctStreak, Math.min(index + 1, 6));
    assert.equal(state.memorized, false);
    assert.equal(lastGradeLabel(state), index < 5 ? `Correct ${index + 1}` : 'Ready to mark as memorized');
    const lapse = submit(progress, prompt, state.due, 'incorrect');
    assert.equal(lapse.characters['火'].correctStreak, 0);
    assert.equal(lapse.characters['火'].due, null);
    assert.equal(lastGradeLabel(lapse.characters['火']), 'Incorrect');
    at = state.due + minute;
  }
  const frozen = submit(progress, prompt, at, 'memorized');
  assert.equal(frozen.characters['火'].memorized, true);
  assert.equal(frozen.characters['火'].due, null);
  assert.equal(reactivate(frozen, '火').characters['火'].due, progress.characters['火'].due);
});

test('new words vary and start in Grade 1', () => {
  const progress = freshProgress();
  assert.notEqual(chooseWord(words, progress, now, first).word.id, chooseWord(words, progress, now, last).word.id);
  assert(chooseWord(words, progress, now, first).targets.every(character => curriculumGrades.get(character) === 1));
});

test('due work beats introductions, old work beats newer work, and memorized stays excluded', () => {
  const earlier = groups.slice(0, 3).flatMap(group => group.characters.map(character => [character, true]));
  let progress = submit(applyMemorization(freshProgress(), earlier), { word: word('yakusoku'), targets: ['約', '束'] }, now, 'memorized');
  progress = reactivate(progress, '束', now);
  progress = reactivate(progress, '約', now - 3 * day);
  const prompt = chooseWord(words, progress, now, last);
  assert(prompt.targets.includes('約'));
  assert(prompt.targets.every(character => progress.characters[character]?.due <= now));
  assert.notEqual(prompt.word.id, 'yakusoku');
  progress = submit(progress, prompt, now, 'memorized');
  const review = chooseWord(words, progress, now, first);
  assert.deepEqual(review.targets, ['束']);
  assert.equal(chooseWord([word('yakubun')], progress, now, first), null);
});

test('v1 history and memorized statuses survive migration to fixed due dates', () => {
  const legacy = {
    version: 1,
    characters: { 約: { due: null, level: 1, memorized: true }, 束: { due: now, level: 1, memorized: false } },
    reviews: [
      { wordId: 'yakusoku', character: '束', outcome: 'incorrect', at: now - day, due: now - day + 10 * minute },
      { wordId: 'hanataba', character: '束', outcome: 'correct', at: now - day + 10 * minute, due: now },
      { wordId: 'yakusoku', character: '約', outcome: 'memorized', at: now - day, due: null },
    ],
  };
  const progress = parseProgress(JSON.stringify(legacy));
  assert.deepEqual(progress.reviews, legacy.reviews);
  assert.equal(progress.characters['約'].memorized, true);
  assert.equal(progress.characters['束'].due, now + 10 * minute);
  assert.equal(progress.characters['束'].correctStreak, 1);
  assert.equal(progress.characters['束'].introducedAt, now - day);
  assert.deepEqual(parseProgress(JSON.stringify(progress)), progress);
  assert.throws(() => parseProgress(JSON.stringify({ ...progress, newPerDay: -1 })));
});

test('v2 migration reconstructs streaks, ignores practice grades and discards FSRS scheduling', () => {
  const reviews = [
    { wordId: 'kazan', character: '火', outcome: 'correct', at: now - day, due: now },
    { wordId: 'kazan', character: '火', outcome: 'correct', at: now, due: now + minute },
    { wordId: 'kazan', character: '火', outcome: 'incorrect', at: now + minute, due: null, practice: true },
    { wordId: 'kazan', character: '山', outcome: 'incorrect', at: now, due: now + minute },
  ];
  const legacy = {
    ...freshProgress(), version: 2, newPerDay: 0, reviews,
    characters: { 火: { card: null, due: null, memorized: true, introducedAt: now - day },
      山: { card: null, due: now + minute, memorized: false, introducedAt: now } },
  };
  const progress = parseProgress(JSON.stringify(legacy));
  assert.equal(progress.version, 3);
  assert.equal(progress.newPerDay, 0);
  assert.deepEqual(progress.reviews, reviews);
  assert.equal(progress.characters['火'].correctStreak, 2);
  assert.equal(progress.characters['火'].pausedDue, now + 3 * day);
  assert.equal(progress.characters['山'].due, null);
  assert.equal(lastGradeLabel(progress.characters['山']), 'Incorrect');
  assert.deepEqual(parseProgress(JSON.stringify(progress)), progress);
  progress.characters['火'].correctStreak = 7;
  assert.throws(() => parseProgress(JSON.stringify(progress)));
});
