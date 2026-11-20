export function readingCue(word, targets) {
  const spelling = [...word.spelling];
  const tested = new Set(targets);
  const { reading, readingParts } = word;
  const mapped = Array.isArray(readingParts) && readingParts.length === spelling.length &&
    readingParts.every(part => typeof part === 'string' && part.length > 0) &&
    readingParts.join('') === reading;
  if (!mapped) {
    const kanji = spelling.filter(character => /\p{Script=Han}/u.test(character));
    const positions = kanji.flatMap((character, index) => tested.has(character) ? [index + 1] : []);
    const complete = spelling.every(character => tested.has(character));
    return {
      parts: [{ text: reading, tested: complete }],
      hint: !complete && positions.length ? `Write kanji ${positions.join(' and ')} of ${kanji.length}.` : '',
    };
  }
  const parts = [];
  for (const [index, text] of readingParts.entries()) {
    const underline = tested.has(spelling[index]);
    const previous = parts.at(-1);
    if (previous?.tested === underline) previous.text += text;
    else parts.push({ text, tested: underline });
  }
  return { parts, hint: '' };
}
