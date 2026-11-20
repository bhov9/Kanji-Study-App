import { curriculumGrades } from './curriculum.js';
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

export const maxNewPerDay = 20;
export const defaultNewPerDay = 5;
export const freshProgress = () => ({
  version: 2, newPerDay: defaultNewPerDay, characters: {}, reviews: [],
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

export function chooseWord(words, progress, now, random = Math.random) {
  const { characters, reviews, newPerDay } = progress;
  const matching = (eligible, limit = Infinity) => words.map(word => ({
    word,
    targets: word.characters.filter(eligible).slice(0, limit),
  })).filter(candidate => candidate.targets.length);
  let candidates = matching(character => isDue(characters[character], now));
  let practice = false;

  if (candidates.length) {
    // Work within an hour of the oldest due item so randomized reviews cannot
    // keep a long-overdue card behind newer reviews.
    for (const candidate of candidates) {
      candidate.due = Math.min(...candidate.targets.map(character => characters[character].due));
    }
  } else {
    const dayStart = startOfDay(now);
    const introducedToday = Object.values(characters)
      .filter(state => state.introducedAt !== null && state.introducedAt >= dayStart && state.introducedAt <= now).length;
    const remaining = newPerDay - introducedToday;
    const unseen = new Set(words.flatMap(word => word.characters).filter(character => !characters[character]));
    const grade = Math.min(...Array.from(unseen, character => curriculumGrades.get(character)));
    const atGrade = character => unseen.has(character) && curriculumGrades.get(character) === grade;
    candidates = remaining > 0 ? matching(atGrade, remaining) : [];
    if (!candidates.length) {
      practice = true;
      candidates = matching(character => characters[character] && !characters[character].memorized);
      // Preview without enrolling a card when the introduction limit is zero.
      if (!candidates.length) candidates = matching(atGrade, 1);
      // An entirely memorized deck remains available for optional practice.
      if (!candidates.length) candidates = matching(character => characters[character]?.memorized);
    }
  }

  if (!candidates.length) return null;
  const previousWord = reviews[reviews.length - 1]?.wordId;
  const alternatives = candidates.filter(candidate => candidate.word.id !== previousWord);
  if (alternatives.length) candidates = alternatives;
  if (candidates[0].due !== undefined) {
    const oldest = Math.min(...candidates.map(candidate => candidate.due));
    candidates = candidates.filter(candidate => candidate.due <= oldest + hour);
  }
  return { ...candidates[Math.floor(random() * candidates.length)], practice };
}

export function submitWord(progress, prompt, selections, at = Date.now()) {
  const { word, targets, practice } = prompt;
  if (!targets.length || targets.some(character =>
    !outcomes.includes(selections.get(character)) ||
    (!practice && progress.characters[character] && !isDue(progress.characters[character], at)))) {
    throw new Error('The word has incomplete or expired selections');
  }
  const characters = { ...progress.characters };
  const reviews = [...progress.reviews];
  for (const character of targets) {
    const outcome = selections.get(character);
    const previous = characters[character];
    const memorized = outcome === 'memorized';
    if (practice) {
      if (memorized && !previous?.memorized) {
        characters[character] = markMemorized({ characters }, character).characters[character];
      }
      reviews.push({ wordId: word.id, character, outcome, at, due: characters[character]?.due ?? null, practice: true });
      continue;
    }
    const card = memorized ? null : schedule(previous?.card, outcome, at);
    const due = card?.due ?? null;
    characters[character] = { memorized, due, card, introducedAt: previous ? previous.introducedAt : at };
    reviews.push({ wordId: word.id, character, outcome, at, due });
  }
  return { ...progress, characters, reviews };
}

export function markMemorized(progress, character) {
  const previous = progress.characters[character] ?? { card: null, introducedAt: null, browserOnly: true };
  return {
    ...progress,
    characters: {
      ...progress.characters,
      [character]: { ...previous, due: null, memorized: true },
    },
  };
}

export function reactivate(progress, character, now = Date.now()) {
  const previous = progress.characters[character];
  if (!previous?.memorized) return progress;
  const characters = { ...progress.characters };
  if (previous.browserOnly) delete characters[character];
  else characters[character] = { ...previous, due: now, memorized: false };
  return { ...progress, characters };
}

export const validNewPerDay = value => Number.isInteger(value) && value >= 0 && value <= maxNewPerDay;
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
