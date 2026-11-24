import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFeedback, validateFeedback, withRestoredFeedback } from '../feedback.js';
import { splitKunReading } from '../dictionary-readings.js';

const entry = { id: 'test', text: 'Prioritize じゅう.', at: '2026-11-24T00:00:00.000Z',
  page: 'Writing Screen', character: '十', word: '十日', reading: 'とおか' };

test('feedback validation derives identifiers and preserves word context', () => {
  const [clean] = validateFeedback([{ ...entry, grade: 999 }]);
  assert.equal(clean.unicode, 'U+5341');
  assert.equal(clean.kanjiId, '十');
  assert.equal(clean.grade, 1);
  assert.match(formatFeedback([clean]), /^1\. \[Kanji \| 十 \| U\+5341 \| Grade 1 \| Writing Screen \| 十日（とおか）\]/);
  assert.throws(() => validateFeedback([entry, entry]));
  assert.throws(() => validateFeedback([{ ...entry, character: 'ok' }]));
  assert.throws(() => validateFeedback([{ ...entry, at: 'bad date' }]));
});

test('an unsuccessful progress restore rolls back feedback', () => {
  const stored = new Map();
  globalThis.localStorage = {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: key => stored.delete(key),
  };
  const key = 'kanji-practice.feedback';
  withRestoredFeedback([entry], () => {});
  const before = stored.get(key);
  assert.throws(() => withRestoredFeedback([], () => { throw new Error('quota'); }));
  assert.equal(stored.get(key), before);
  withRestoredFeedback(undefined, () => {});
  assert.equal(stored.get(key), before);
});

test('okurigana boundaries retain the dictionary stem and suffix', () => {
  assert.deepEqual(splitKunReading('う.まれる'), { stem: 'う', okurigana: 'まれる' });
  assert.deepEqual(splitKunReading('セイ'), { stem: 'セイ', okurigana: '' });
});
