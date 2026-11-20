import { curriculumGrades, groups } from './curriculum.js';
import { createEmptyCard, fsrs, Rating } from './vendor/ts-fsrs.js';

const hour = 60 * 60_000;
const outcomes = ['correct', 'incorrect', 'memorized'];
const scheduler = fsrs({
  request_retention: 0.9,
  learning_steps: ['10m', '30m'],
  relearning_steps: ['10m', '30m'],
  enable_short_term: true,
  enable_fuzz: false,
});

export const minimumIncorrectSeparation = 10;
export const freshProgress = () => ({
  // Keep the former setting in v2 exports for compatibility with earlier builds.
  version: 2, newPerDay: 5, characters: {}, reviews: [],
});

export function startOfDay(now) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function schedule(card, outcome, at) {
  const now = new Date(at);
  const input = card ? {
    ...card,
    due: new Date(card.due),
    last_review: new Date(card.last_review),
  } : createEmptyCard(now);
  const rating = outcome === 'correct' ? Rating.Good : Rating.Again;
  const next = scheduler.next(input, now, rating).card;
  return { ...next, due: next.due.getTime(), last_review: next.last_review.getTime() };
}

function isDue(state, now) {
  return state && !state.memorized && state.due <= now;
}

export function unlockedGrade(characters) {
  return groups.find(group => group.characters.some(character => !characters[character]))?.grade ?? groups.length;
}

function latestReviews(reviews) {
  const latest = new Map();
  for (const [index, review] of reviews.entries()) {
    if (!review.practice) latest.set(review.character, { review, index });
  }
  return latest;
}

export function chooseWord(words, progress, now, random = Math.random, sessionCorrect = new Set()) {
  const { characters, reviews } = progress;
  const grade = unlockedGrade(characters);
  const matching = eligible => words.map(word => ({
    word,
    targets: word.characters.filter(character => eligible.has(character)),
  })).filter(candidate => candidate.targets.length);
  const latest = latestReviews(reviews);
  const today = startOfDay(now);
  const fresh = new Set();
  const due = new Set();
  for (const character of new Set(words.flatMap(word => word.characters))) {
    const state = characters[character];
    if (!state && curriculumGrades.get(character) === grade) fresh.add(character);
    if (!isDue(state, now) || sessionCorrect.has(character)) continue;
    const previous = latest.get(character)?.review;
    if (previous?.outcome === 'correct' && previous.at >= today) continue;
    due.add(character);
  }

  const eligible = new Set(due);
  const waitingIncorrect = new Set();
  for (const character of due) {
    const previous = latest.get(character);
    if (previous?.review.outcome !== 'incorrect') continue;
    const studiedAfter = new Set();
    for (const [other, record] of latest) {
      const sameSubmission = record.review.at === previous.review.at &&
        record.review.wordId === previous.review.wordId;
      if (record.index > previous.index && !sameSubmission) {
        studiedAfter.add(other);
        if (studiedAfter.size >= minimumIncorrectSeparation) break;
      }
    }
    if (studiedAfter.size >= minimumIncorrectSeparation) continue;
    eligible.delete(character);
    waitingIncorrect.add(character);
  }

  let lastReview;
  for (let index = reviews.length - 1; index >= 0; index--) {
    if (!reviews[index].practice) {
      lastReview = reviews[index];
      break;
    }
  }
  let candidates = matching(eligible);
  let reviewing = candidates.length > 0;
  if (!reviewing) candidates = matching(fresh);
  // The remaining due cards can all be waiting on one another. Relax the
  // count only after exhausting other work, and never before the FSRS due time.
  if (!candidates.length && waitingIncorrect.size) {
    const nonrepeating = new Set([...waitingIncorrect].filter(character => {
      const previous = latest.get(character).review;
      return previous.at !== lastReview.at || previous.wordId !== lastReview.wordId;
    }));
    candidates = matching(nonrepeating.size ? nonrepeating : waitingIncorrect);
    reviewing = true;
  }

  if (!candidates.length) return null;
  if (reviewing) {
    // Work within an hour of the oldest due item so randomized reviews cannot
    // keep a long-overdue card behind newer reviews.
    for (const candidate of candidates) {
      candidate.due = Math.min(...candidate.targets.map(character => characters[character].due));
    }
  }

  const alternatives = candidates.filter(candidate => candidate.word.id !== lastReview?.wordId);
  if (alternatives.length) candidates = alternatives;
  if (candidates[0].due !== undefined) {
    const oldest = Math.min(...candidates.map(candidate => candidate.due));
    candidates = candidates.filter(candidate => candidate.due <= oldest + hour);
  }
  const familiar = candidates.filter(({ word }) => word.characters.every(character =>
    characters[character] || curriculumGrades.get(character) <= grade));
  if (familiar.length) candidates = familiar;
  return candidates[Math.floor(random() * candidates.length)];
}

export function chooseHandwritingWord(words, characters, previousId, random = Math.random) {
  const grade = unlockedGrade(characters);
  const candidates = words.map(word => ({
    word,
    targets: word.characters.filter(character => characters[character] || curriculumGrades.get(character) <= grade),
  })).filter(candidate => candidate.targets.length);
  const alternatives = candidates.filter(candidate => candidate.word.id !== previousId);
  const pool = alternatives.length ? alternatives : candidates;
  return pool.length ? { ...pool[Math.floor(random() * pool.length)], practice: true } : null;
}

export function submitWord(progress, prompt, selections, at = Date.now()) {
  const { word, targets, practice } = prompt;
  if (practice) return progress;
  const grade = unlockedGrade(progress.characters);
  if (!targets.length || targets.some(character =>
    !outcomes.includes(selections.get(character)) ||
    (!progress.characters[character] && curriculumGrades.get(character) !== grade) ||
    (progress.characters[character] && !isDue(progress.characters[character], at)))) {
    throw new Error('The word has incomplete or expired selections');
  }
  const characters = { ...progress.characters };
  const reviews = [...progress.reviews];
  for (const character of targets) {
    const outcome = selections.get(character);
    const previous = characters[character];
    const memorized = outcome === 'memorized';
    const card = memorized ? previous?.card ?? null : schedule(previous?.card, outcome, at);
    const due = memorized ? null : card.due;
    characters[character] = { memorized, due, card, introducedAt: previous ? previous.introducedAt : at };
    reviews.push({ wordId: word.id, character, outcome, at, due });
  }
  return { ...progress, characters, reviews };
}

export function applyMemorization(progress, changes, now = Date.now()) {
  const characters = { ...progress.characters };
  for (const [character, memorized] of changes) {
    const previous = characters[character];
    if (Boolean(previous?.memorized) === memorized) continue;
    if (memorized) {
      const state = previous ?? { card: null, introducedAt: null, browserOnly: true };
      characters[character] = { ...state, due: null, memorized: true };
    } else if (previous.browserOnly) {
      delete characters[character];
    } else {
      characters[character] = { ...previous, due: previous.card?.due ?? now, memorized: false };
    }
  }
  return { ...progress, characters };
}

export function markMemorized(progress, character) {
  return applyMemorization(progress, [[character, true]]);
}

export function reactivate(progress, character, now = Date.now()) {
  return applyMemorization(progress, [[character, false]], now);
}

const validNewPerDay = value => Number.isInteger(value) && value >= 0 && value <= 20;
const isDate = value => Number.isSafeInteger(value) && value >= 0 && value <= 8.64e15;
const isKanji = value => typeof value === 'string' && /^\p{Script=Han}$/u.test(value);
const isCount = value => Number.isSafeInteger(value) && value >= 0;

function validCard(card) {
  return card === null || (card && isDate(card.due) && isDate(card.last_review) &&
    Number.isFinite(card.stability) && card.stability > 0 &&
    Number.isFinite(card.difficulty) && card.difficulty >= 1 && card.difficulty <= 10 &&
    [1, 2, 3].includes(card.state) &&
    [card.reps, card.lapses, card.elapsed_days, card.scheduled_days, card.learning_steps].every(isCount));
}

function migrateLegacy(data) {
  const cards = new Map();
  const introduced = new Map();
  for (const review of [...data.reviews].sort((a, b) => a.at - b.at)) {
    if (!introduced.has(review.character)) introduced.set(review.character, review.at);
    const card = review.outcome === 'memorized' ? null :
      schedule(cards.get(review.character), review.outcome, review.at);
    cards.set(review.character, card);
  }
  const characters = Object.fromEntries(Object.entries(data.characters).map(([character, state]) => [
    character,
    {
      memorized: state.memorized,
      due: state.due,
      card: state.memorized ? null : cards.get(character) ?? null,
      introducedAt: introduced.get(character) ?? null,
    },
  ]));
  return { ...freshProgress(), characters, reviews: data.reviews };
}

export function parseProgress(raw) {
  const data = JSON.parse(raw);
  const legacy = data?.version === 1;
  const statesValid = data?.characters && typeof data.characters === 'object' &&
    !Array.isArray(data.characters) && Object.entries(data.characters).every(([character, state]) =>
      isKanji(character) && state && typeof state.memorized === 'boolean' &&
      (state.memorized ? state.due === null : isDate(state.due)) &&
      (legacy ? isCount(state.level) && state.level <= 7 :
        (state.introducedAt === null || isDate(state.introducedAt)) && validCard(state.card) &&
        (state.browserOnly === undefined || (state.browserOnly === true &&
          state.memorized && state.card === null && state.introducedAt === null))));
  const reviewsValid = Array.isArray(data?.reviews) && data.reviews.every(review =>
    review && typeof review.wordId === 'string' && isKanji(review.character) &&
    isDate(review.at) && outcomes.includes(review.outcome) &&
    (review.practice === undefined || (!legacy && review.practice === true)) &&
    (review.outcome === 'memorized' ? review.due === null :
      isDate(review.due) || (review.practice === true && review.due === null)));
  if ((!legacy && (data?.version !== 2 || !validNewPerDay(data.newPerDay))) || !statesValid || !reviewsValid) {
    throw new Error('Unrecognized progress data');
  }
  return legacy ? migrateLegacy(data) : data;
}
