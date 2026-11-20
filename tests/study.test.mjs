import assert from 'node:assert/strict';
import test from 'node:test';
import { kanji, words } from '../data.js';
import { chooseWord, freshProgress, nextStudyTime, parseProgress, reactivate, submitWord } from '../study.js';

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
  assert.equal(saved.characters['山'].due, now + 10 * minute);
  assert.equal(saved.characters['火'].due, now + 30 * minute);
  assert.throws(() => submitWord(saved, prompt, selections, now));
  assert.deepEqual(parseProgress(JSON.stringify(saved)), saved);
});

test('FSRS graduates learning, extends recall, and relearns lapses', () => {
  const prompt = { word: word('kazan'), targets: ['火'] };
  let progress = submit(freshProgress(), prompt, now);
  let due = progress.characters['火'].due;
  progress = submit(progress, prompt, due);
  const firstInterval = progress.characters['火'].due - due;
  assert(firstInterval >= day);
  assert.equal(progress.characters['火'].card.state, 2);
  due = progress.characters['火'].due;
  progress = submit(progress, prompt, due);
  assert(progress.characters['火'].due - due > firstInterval);
  const card = progress.characters['火'].card;
  due = progress.characters['火'].due;
  const lapse = submit(progress, prompt, due, 'incorrect');
  assert.equal(lapse.characters['火'].due, due + 10 * minute);
  assert(lapse.characters['火'].card.stability < card.stability);
  assert.equal(lapse.characters['火'].card.state, 3);
  const delayed = submit(progress, prompt, due + 15 * day);
  const onTime = submit(progress, prompt, due);
  assert.notEqual(delayed.characters['火'].card.stability, onTime.characters['火'].card.stability);
});

test('new words vary, start in grade one, and respect the daily limit and grade order', () => {
  let progress = freshProgress();
  assert.notEqual(chooseWord(words, progress, now, first).word.id, chooseWord(words, progress, now, last).word.id);
  while (progress.reviews.length < 5) {
    const prompt = chooseWord(words, progress, now, first);
    assert(prompt.targets.every(character => kanji[character][0] === 1));
    assert.notEqual(prompt.word.id, progress.reviews.at(-1)?.wordId);
    progress = submit(progress, prompt, now, 'memorized');
  }
  assert.equal(progress.reviews.length, 5);
  assert.equal(chooseWord(words, progress, now, first), null);
  const tomorrow = nextStudyTime(words, progress, now);
  assert.equal(new Date(tomorrow).getHours(), 0);
  assert(chooseWord(words, progress, tomorrow, first));
  const gradeOne = Object.keys(kanji).filter(character => kanji[character][0] === 1);
  for (const character of gradeOne) {
    progress.characters[character] = { due: null, card: null, memorized: true, introducedAt: null };
  }
  assert(chooseWord(words, progress, tomorrow, first).targets.every(character => kanji[character][0] === 2));
});

test('due work beats introductions, old work beats newer work, and memorized stays excluded', () => {
  let progress = submit(freshProgress(), { word: word('yakusoku'), targets: ['約', '束'] }, now, 'memorized');
  progress = reactivate(progress, '束', now);
  progress = reactivate(progress, '約', now - 3 * day);
  const prompt = chooseWord(words, progress, now, last);
  assert(prompt.targets.includes('約'));
  assert(prompt.targets.every(character => progress.characters[character]?.due <= now));
  assert.notEqual(prompt.word.id, 'yakusoku');
  progress = submit(progress, prompt, now, 'memorized');
  const review = chooseWord(words, progress, now, first);
  assert.deepEqual(review.targets, ['束']);
  assert.equal(chooseWord([word('yakubun')], { ...progress, newPerDay: 0 }, now, first), null);
});

test('legacy logs, due dates and memorized states survive migration and export', () => {
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
  assert.equal(progress.characters['束'].due, now);
  assert.equal(progress.characters['束'].card.reps, 2);
  assert.equal(progress.characters['束'].introducedAt, now - day);
  assert.deepEqual(parseProgress(JSON.stringify(progress)), progress);
  assert.throws(() => parseProgress(JSON.stringify({ ...progress, newPerDay: -1 })));
});
