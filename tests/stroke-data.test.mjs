import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { curriculumGrades } from '../curriculum.js';

test('offline KanjiVG bundles cover the full curriculum with ordered paths', () => {
  const coverage = new Map();
  for (let index = 0; index < 32; index++) {
    const name = index.toString(16).padStart(2, '0');
    const records = JSON.parse(readFileSync(new URL(`../stroke-data/${name}.json`, import.meta.url), 'utf8'));
    for (const [character, paths] of Object.entries(records)) {
      assert.equal(character.codePointAt(0) % 32, index, character);
      assert(!coverage.has(character), character);
      assert(paths.length > 0 && paths.every(path => /^M/i.test(path)), character);
      coverage.set(character, paths.length);
    }
  }
  assert.deepEqual(new Set(coverage.keys()), new Set(curriculumGrades.keys()));
  assert.equal(coverage.get('番'), 12);
  assert.equal(coverage.get('号'), 5);
});
