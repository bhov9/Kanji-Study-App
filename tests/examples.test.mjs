import assert from 'node:assert/strict';
import test from 'node:test';
import { words } from '../data.js';
import { exampleFor, examplesByWord } from '../examples.js';

test('example records use deck IDs and conceal all target kanji outside one slot', () => {
  for (const [id, examples] of Object.entries(examplesByWord)) {
    const word = words.find(entry => entry.id === id);
    assert(word, `Unknown example word ${id}`);
    for (const example of examples) {
      assert.equal(example.parts.filter(part => part.target === true).length, 1, id);
      for (const part of example.parts) {
        if (part.target) continue;
        const text = typeof part === 'string' ? part : part.ruby;
        if (typeof part !== 'string') assert.match(part.reading, /^[ぁ-ゖー]+$/u);
        for (const character of word.characters) assert(!text.includes(character), `Answer leaked in ${id}`);
      }
      if (example.historicalNote) {
        assert.equal(example.verification, 'source-checked');
        assert(example.sources.length);
        for (const source of example.sources) assert.equal(new URL(source.url).protocol, 'https:');
      }
    }
    assert.equal(exampleFor(id), examples[0]);
  }
  assert.equal(exampleFor('no-example'), undefined);
});
