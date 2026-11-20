import assert from 'node:assert/strict';
import test from 'node:test';
import { groups } from '../curriculum.js';
import { words } from '../data.js';
import { applyMemorization, chooseWord, freshProgress, submitWord, unlockedGrade } from '../study.js';

test('coverage and progression use the entire curriculum, including rarely tested characters', () => {
  const covered = new Set(words.flatMap(word => word.characters));
  assert.equal(covered.size, 2136);
  let progress = { ...freshProgress(), newPerDay: 20 };
  for (const group of groups) {
    assert.equal(unlockedGrade(progress.characters), group.grade);
    const last = group.characters.at(-1);
    progress = applyMemorization(progress, group.characters.slice(0, -1).map(character => [character, true]));
    assert.equal(unlockedGrade(progress.characters), group.grade);
    const now = 1_800_000_000_000;
    const prompt = chooseWord(words, progress, now, () => 0);
    assert.deepEqual(prompt.targets, [last]);
    progress = submitWord(progress, prompt, new Map([[last, 'correct']]), now);
  }
});

test('bulk edits leave history and FSRS cards intact and can re-lock new kanji without blocking existing reviews', () => {
  const fresh = freshProgress();
  const now = 1_800_000_000_000;
  const gradeOne = groups[0].characters.map(character => [character, true]);
  const progressed = applyMemorization(fresh, gradeOne);
  assert.deepEqual(progressed.reviews, []);
  const prompt = chooseWord(words, progressed, now, () => 0);
  assert(prompt.targets.every(character => groups[1].characters.includes(character)));
  const studied = submitWord(progressed, prompt, new Map(prompt.targets.map(character => [character, 'correct'])), now);
  const character = prompt.targets[0];
  const reopened = applyMemorization(studied, [[groups[0].characters[0], false], [character, true]], now);
  assert.equal(unlockedGrade(reopened.characters), 1);
  assert.deepEqual(reopened.characters[character].card, studied.characters[character].card);
  assert.deepEqual(reopened.reviews, studied.reviews);
  const restored = applyMemorization(reopened, [[character, false]], now);
  assert.deepEqual(chooseWord(words, restored, now, () => 0).targets, [character]);
  assert.deepEqual(restored.characters[character].card, studied.characters[character].card);
});
