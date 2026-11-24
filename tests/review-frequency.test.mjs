import assert from 'node:assert/strict';
import test from 'node:test';
import { groups } from '../curriculum.js';
import { chooseHandwritingWord, chooseWord, freshProgress, minimumIncorrectSeparation, parseProgress, submitWord } from '../study.js';

const now = new Date(2026, 10, 21, 9).getTime();
const minute = 60_000;
const day = 1440 * minute;
const first = () => 0;
const word = (...characters) => ({ id: characters.join(''), characters });
const deck = groups[0].characters.slice(0, 35).map(character => word(character));
const grade = (progress, entry, outcome, at = now) => submitWord(progress,
  { word: entry, targets: entry.characters }, new Map(entry.characters.map(character => [character, outcome])), at);

test('an incorrect grade waits for ten distinct other tested kanji and then restarts at Correct 1', () => {
  const missed = deck[0];
  const [character] = missed.characters;
  let progress = grade(freshProgress(), missed, 'incorrect');
  assert.equal(progress.characters[character].due, null);
  for (let index = 1; index < minimumIncorrectSeparation; index++) {
    progress = grade(progress, deck[index], 'correct', now + index);
  }
  const repeated = progress.reviews.at(-1);
  progress.reviews.push({ ...repeated, at: now + 100 });
  progress.reviews.push({ ...repeated, character: deck[10].characters[0], at: now + 101, practice: true });
  assert(!chooseWord(deck, progress, now + 10 * minute, first).targets.includes(character));
  progress = grade(progress, deck[10], 'correct', now + 200);
  assert.equal(progress.characters[character].due, now + 200);
  assert.deepEqual(chooseWord(deck, progress, now + 200, first).targets, [character]);
  assert.deepEqual(chooseWord(deck, parseProgress(JSON.stringify(progress)), now + 200, first).targets, [character]);
  assert.equal(grade(progress, missed, 'correct', now + 200).characters[character].correctStreak, 1);
  assert.equal(grade(progress, missed, 'correct', now + 200).characters[character].due, now + 200 + day);
});

test('the same vocabulary submission does not count as separation', () => {
  const [a, b] = deck.map(entry => entry.characters[0]);
  const pair = word(a, b);
  let progress = grade(freshProgress(), pair, 'incorrect');
  for (let index = 2; index < 11; index++) progress = grade(progress, deck[index], 'correct', now + index);
  assert(!chooseWord([pair, ...deck], progress, now + 10 * minute, first).targets.includes(a));
});

test('migration releases a missed kanji at the tenth distinct historical grade without rewriting the log', () => {
  const [character] = deck[0].characters;
  const reviews = deck.slice(0, 11).map(({ id, characters: [kanji] }, index) => ({
    character: kanji, wordId: id, outcome: index ? 'correct' : 'incorrect',
    at: now + index, due: now + minute,
  })).reverse();
  const legacy = {
    version: 2, newPerDay: 5, reviews,
    characters: { [character]: { card: null, due: now + minute, memorized: false, introducedAt: now } },
  };
  const migrated = parseProgress(JSON.stringify(legacy));
  assert.deepEqual(migrated.reviews, reviews);
  assert.equal(migrated.characters[character].due, now + 10);
  assert.equal(chooseWord([deck[0]], migrated, now + 9, first), null);
  assert.deepEqual(chooseWord([deck[0]], migrated, now + 10, first).targets, [character]);
});

test('correct answers become eligible at exactly 24 elapsed hours', () => {
  const [entry] = deck;
  const [character] = entry.characters;
  const progress = grade(freshProgress(), entry, 'correct');
  assert.equal(progress.characters[character].due, now + day);
  assert.equal(chooseWord([entry], progress, now + day - 1, first), null);
  assert.deepEqual(chooseWord([entry], progress, now + day, first).targets, [character]);
});

test('a small pool never bypasses the separation rule', () => {
  const [a, b] = deck;
  let progress = grade(freshProgress(), a, 'incorrect');
  assert.equal(chooseWord([a], progress, now + day, first), null);
  assert.throws(() => grade(progress, a, 'correct', now + day));
  progress = grade(progress, b, 'incorrect', now + 1);
  assert.equal(chooseWord([a, b], progress, now + day, first), null);
});

test('mixed words exclude cooled-down kanji and new study has no daily cap', () => {
  const [a, b] = deck;
  const progress = grade(freshProgress(), a, 'correct');
  const mixed = word(...a.characters, ...b.characters);
  assert.deepEqual(chooseWord([mixed], progress, now + 40 * minute, first).targets, b.characters);
  let unlimited = { ...freshProgress(), newPerDay: 0 };
  for (let index = 0; index < 30; index++) {
    const prompt = chooseWord(deck, unlimited, now + index, first);
    unlimited = grade(unlimited, prompt.word, 'correct', now + index);
  }
  assert.equal(unlimited.reviews.length, 30);
});

test('optional handwriting can repeat without creating grades, counters or scheduling changes', () => {
  const [entry] = deck;
  const progress = grade(freshProgress(), entry, 'incorrect');
  for (let attempt = 0; attempt < 20; attempt++) {
    const prompt = chooseHandwritingWord([entry], progress.characters, entry.id, first);
    assert.equal(prompt.word, entry);
    assert.equal(submitWord(progress, prompt, new Map([[entry.characters[0], 'correct']]), now), progress);
  }
  assert.equal(chooseWord([entry], progress, now, first), null);
  assert.equal(progress.reviews.length, 1);
});
