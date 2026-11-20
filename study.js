const minute = 60_000;
const day = 1440 * minute;
const intervals = [1, 3, 7, 14, 30, 60, 120];

export const freshProgress = () => ({ version: 1, characters: {}, reviews: [] });

export function record(progress, word, character, outcome, at = Date.now()) {
  const previous = progress.characters[character];
  const level = outcome === 'incorrect' ? 0 : (previous?.level ?? 0);
  const next = outcome === 'correct' ? Math.min(level + 1, intervals.length) : level;
  const due = outcome === 'memorized' ? null : at + (outcome === 'correct' ? intervals[next - 1] * day : 10 * minute);
  return {
    ...progress,
    characters: { ...progress.characters, [character]: { level: next, due, memorized: outcome === 'memorized' } },
    reviews: [...progress.reviews, { wordId: word.id, character, outcome, at, due }],
  };
}

export function targetsFor(word, progress, now) {
  return word.characters.filter(character => {
    const state = progress.characters[character];
    return !state || (!state.memorized && state.due <= now);
  });
}

export function chooseWord(words, progress, now, previousId) {
  const lastSeen = new Map();
  for (const review of progress.reviews) {
    lastSeen.set(review.wordId, Math.max(review.at, lastSeen.get(review.wordId) ?? -Infinity));
  }
  let best = null;
  for (const word of words) {
    const targets = targetsFor(word, progress, now);
    if (!targets.length) continue;
    const oldest = Math.min(...targets.map(character => progress.characters[character]?.due ?? Infinity));
    const seen = lastSeen.get(word.id) ?? -Infinity;
    const candidate = { word, targets, oldest, seen };
    if (!best || oldest < best.oldest ||
        (oldest === best.oldest && (seen < best.seen ||
          (seen === best.seen && best.word.id === previousId && word.id !== previousId)))) {
      best = candidate;
    }
  }
  return best;
}

export function reactivate(progress, character, now = Date.now()) {
  return {
    ...progress,
    characters: { ...progress.characters, [character]: { level: 0, due: now, memorized: false } },
  };
}

export function parseProgress(raw) {
  const data = JSON.parse(raw);
  const outcomes = ['correct', 'incorrect', 'memorized'];
  const date = value => Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
  const validCharacter = value => typeof value === 'string' && /^\p{Script=Han}$/u.test(value);
  const statesValid = data?.characters && typeof data.characters === 'object' &&
    !Array.isArray(data.characters) &&
    Object.entries(data.characters).every(([character, state]) =>
      validCharacter(character) && state && Number.isInteger(state.level) &&
      state.level >= 0 && state.level <= intervals.length &&
      typeof state.memorized === 'boolean' && (state.memorized ? state.due === null : date(state.due)));
  const reviewsValid = Array.isArray(data?.reviews) && data.reviews.every(review =>
    review && typeof review.wordId === 'string' && validCharacter(review.character) &&
    date(review.at) && outcomes.includes(review.outcome) &&
    (review.outcome === 'memorized' ? review.due === null : date(review.due)));
  if (data?.version !== 1 || !statesValid || !reviewsValid) throw new Error('Unrecognized progress data');
  return data;
}
