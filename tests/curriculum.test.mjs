import assert from 'node:assert/strict';
import test from 'node:test';
import { groups, curriculumGrades } from '../curriculum.js';
import { kanjiNotes, words } from '../data.js';
import { kanjiReference } from '../kanji-reference.js';
import {
  chooseWord, freshProgress, markMemorized, parseProgress, reactivate, submitWord,
} from '../study.js';

test('all official groups use unique Han code points and have reference data', () => {
  assert.deepEqual(groups.map(group => group.characters.length), [80, 160, 200, 202, 193, 191, 1110]);
  const characters = groups.flatMap(group => group.characters);
  assert.equal(new Set(characters).size, 2136);
  assert.equal(curriculumGrades.size, 2136);
  assert.equal(Object.keys(kanjiReference).length, 2136);
  for (const character of characters) {
    assert.match(character, /^\p{Script=Han}$/u);
    const { meanings, on, kun } = kanjiReference[character];
    assert(meanings.length > 0 || on.length > 0 || kun.length > 0);
  }
  for (const [character, grade] of Object.entries({ 一: 1, 会: 2, 県: 3, 茨: 4, 埼: 4, 崎: 4, 圧: 5, 胃: 6, 𠮟: 7 })) {
    assert.equal(curriculumGrades.get(character), grade);
  }
  for (const character of Object.keys(kanjiNotes)) assert(curriculumGrades.has(character));
  for (const word of words) {
    assert(word.characters.length);
    assert.deepEqual(word.grades, [...new Set(word.characters.map(character => curriculumGrades.get(character)))]);
  }
});

test('a browser-only memorized kanji survives backup and can return to Not Started', () => {
  const character = '𠮟';
  const progress = markMemorized(freshProgress(), character);
  assert.equal(progress.characters[character].memorized, true);
  assert.deepEqual(progress.reviews, []);
  assert.deepEqual(parseProgress(JSON.stringify(progress)), progress);
  const reactivated = reactivate(progress, character);
  assert.deepEqual(reactivated, freshProgress());
  for (const now of [0, Date.now()]) {
    assert.deepEqual(chooseWord(words, progress, now, () => 0), chooseWord(words, reactivated, now, () => 0));
  }
});

test('browsing can suspend and restart a studied kanji without altering its review history', () => {
  const now = Date.now();
  const prompt = chooseWord(words, freshProgress(), now, () => 0);
  const studied = submitWord(freshProgress(), prompt,
    new Map(prompt.targets.map(character => [character, 'correct'])), now);
  const [character] = prompt.targets;
  const paused = markMemorized(studied, character);
  assert.deepEqual(paused.reviews, studied.reviews);
  assert.deepEqual(parseProgress(JSON.stringify(paused)), paused);
  assert(!chooseWord(words, paused, now, () => 0).targets.includes(character));
  const resumed = reactivate(paused, character, now + 1);
  assert.deepEqual(resumed.characters[character].card, studied.characters[character].card);
  assert.deepEqual(resumed.reviews, studied.reviews);
  const matching = words.filter(word => word.characters.includes(character));
  const tomorrow = new Date(now).setHours(24, 0, 0, 0);
  assert.equal(resumed.characters[character].due, studied.characters[character].due);
  assert(chooseWord(matching, resumed, Math.max(tomorrow, resumed.characters[character].due), () => 0)
    .targets.includes(character));
});
