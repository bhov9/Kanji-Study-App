import assert from 'node:assert/strict';
import test from 'node:test';
import { words } from '../data.js';
import { readingCue } from '../reading-cue.js';

const underlined = (word, targets) => readingCue(word, targets).parts
  .filter(part => part.tested).map(part => part.text);

test('番号 underlines the chosen reading, with adjacent targets joined', () => {
  const word = words.find(entry => entry.id === 'bangou');
  assert.deepEqual(underlined(word, ['番']), ['ばん']);
  assert.deepEqual(underlined(word, ['号']), ['ごう']);
  assert.deepEqual(underlined(word, ['番', '号']), ['ばんごう']);
});

test('okurigana stays plain and nonadjacent tested kanji stay separate', () => {
  const eat = { spelling: '食べる', reading: 'たべる', readingParts: ['た', 'べ', 'る'] };
  assert.deepEqual(underlined(eat, ['食']), ['た']);
  const bulletTrain = { spelling: '新幹線', reading: 'しんかんせん', readingParts: ['しん', 'かん', 'せん'] };
  assert.deepEqual(underlined(bulletTrain, ['新', '線']), ['しん', 'せん']);
});

test('ambiguous and malformed boundaries fall back to positions without kanji', () => {
  const today = { spelling: '今日', reading: 'きょう' };
  assert.deepEqual(readingCue(today, ['日']), {
    parts: [{ text: 'きょう', tested: false }], hint: 'Write kanji 2 of 2.',
  });
  assert.deepEqual(underlined(today, ['今', '日']), ['きょう']);
  assert.deepEqual(underlined({ ...today, readingParts: ['こん', 'にち'] }, ['今']), []);
});

test('all current deck mappings reproduce the entire reading', () => {
  for (const word of words) {
    for (const character of word.characters) {
      const cue = readingCue(word, [character]);
      assert.equal(cue.parts.map(part => part.text).join(''), word.reading, word.id);
      if (word.readingParts) assert.equal(cue.hint, '', word.id);
      assert(cue.hint || cue.parts.some(part => part.tested), word.id);
    }
  }
});
