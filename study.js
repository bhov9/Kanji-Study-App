import { curriculumGrades, groups } from './curriculum.js';
const hour = 60 * 60_000;
const day = 24 * hour;
const outcomes = ['correct', 'incorrect', 'memorized'];
const correctIntervals = [1, 3, 7, 14, 28, 28];
const maxDate = 8.64e15;

export const minimumIncorrectSeparation = 10;
export const freshProgress = () => ({
  version: 3, newPerDay: 5, characters: {}, reviews: [],
});

export function startOfDay(now) {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

function gradeSchedule(previous, outcome, at) {
  const correctStreak = outcome === 'correct' ? Math.min((previous?.correctStreak ?? 0) + 1, correctIntervals.length) : 0;
  const due = correctStreak ? Math.min(at + correctIntervals[correctStreak - 1] * day, maxDate) : null;
  return { correctStreak, lastGrade: outcome, due };
}

export function lastGradeLabel(state) {
  if (state?.lastGrade === 'incorrect') return 'Incorrect';
  if (!state?.correctStreak) return 'Not yet graded';
  return state.correctStreak === correctIntervals.length ? 'Ready to mark as memorized' : `Correct ${state.correctStreak}`;
}

export function isDue(state, now) {
  return state && !state.memorized && state.due !== null && state.due <= now;
}

function releaseMissedReviews(characters, reviews) {
  const pending = new Set(Object.entries(characters).filter(([, state]) =>
    state.lastGrade === 'incorrect' && (state.memorized ? state.pausedDue : state.due) === null).map(([character]) => character));
  if (!pending.size) return;
  // Legacy backups can retain log entries out of timestamp order.
  if (reviews.some((review, index) => index > 0 && review.at < reviews[index - 1].at)) {
    reviews = [...reviews].sort((a, b) => a.at - b.at);
  }
  const misses = new Map();
  for (const [index, review] of reviews.entries()) {
    if (!review.practice && review.outcome === 'incorrect' && pending.has(review.character)) misses.set(review.character, index);
  }
  for (const [character, index] of misses) {
    const miss = reviews[index];
    const others = new Set();
    for (let i = index + 1; i < reviews.length; i++) {
      const review = reviews[i];
      if (review.practice || review.character === character ||
        (review.at === miss.at && review.wordId === miss.wordId)) continue;
      others.add(review.character);
      if (others.size === minimumIncorrectSeparation) {
        const state = characters[character];
        const due = Math.max(miss.at, review.at);
        characters[character] = state.memorized ? { ...state, pausedDue: due } : { ...state, due };
        break;
      }
    }
  }
}

export function unlockedGrade(characters) {
  return groups.find(group => group.characters.some(character => !characters[character]))?.grade ?? groups.length;
}

export function chooseWord(words, progress, now, random = Math.random, priority = () => 0) {
  const { characters, reviews } = progress;
  const grade = unlockedGrade(characters);
  const matching = eligible => words.map(word => ({
    word,
    targets: word.characters.filter(character => eligible.has(character)),
  })).filter(candidate => candidate.targets.length);
  const fresh = new Set();
  const due = new Set();
  for (const character of new Set(words.flatMap(word => word.characters))) {
    const state = characters[character];
    if (!state && curriculumGrades.get(character) === grade) fresh.add(character);
    if (isDue(state, now)) due.add(character);
  }

  let lastReview;
  for (let index = reviews.length - 1; index >= 0; index--) {
    if (!reviews[index].practice) {
      lastReview = reviews[index];
      break;
    }
  }
  let candidates = matching(due);
  const reviewing = candidates.length > 0;
  if (!reviewing) candidates = matching(fresh);

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
  const first = candidates[Math.floor(random() * candidates.length)];
  const alternativesForTarget = candidates.filter(c => c.targets.some(t => first.targets.includes(t)) &&
    priority(c.word) > priority(first.word));
  if (!alternativesForTarget.length) return first;
  const best = Math.max(...alternativesForTarget.map(c => priority(c.word)));
  const preferred = alternativesForTarget.filter(c => priority(c.word) === best);
  return preferred[Math.floor(random() * preferred.length)];
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
    const schedule = memorized
      ? { correctStreak: previous?.correctStreak ?? 0, lastGrade: previous?.lastGrade ?? null,
          due: null, pausedDue: previous?.due ?? null }
      : gradeSchedule(previous, outcome, at);
    characters[character] = { memorized, introducedAt: previous ? previous.introducedAt : at, ...schedule };
    reviews.push({ wordId: word.id, character, outcome, at, due: schedule.due });
  }
  releaseMissedReviews(characters, reviews);
  return { ...progress, characters, reviews };
}

export function applyMemorization(progress, changes, now = Date.now()) {
  const characters = { ...progress.characters };
  for (const [character, memorized] of changes) {
    const previous = characters[character];
    if (Boolean(previous?.memorized) === memorized) continue;
    if (memorized) {
      const state = previous ?? { correctStreak: 0, lastGrade: null, introducedAt: null, browserOnly: true };
      characters[character] = { ...state, due: null, pausedDue: state.due ?? null, memorized: true };
    } else if (previous.browserOnly) {
      delete characters[character];
    } else {
      const { pausedDue, ...state } = previous;
      characters[character] = { ...state, due: pausedDue ?? (state.lastGrade === 'incorrect' ? null : now), memorized: false };
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
const isDate = value => Number.isSafeInteger(value) && value >= 0 && value <= maxDate;
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
  const schedules = new Map();
  const introduced = new Map();
  const orderedReviews = [...data.reviews].sort((a, b) => a.at - b.at);
  for (const review of orderedReviews) {
    if (review.practice) continue;
    if (!introduced.has(review.character)) introduced.set(review.character, review.at);
    if (review.outcome !== 'memorized') {
      schedules.set(review.character, gradeSchedule(schedules.get(review.character), review.outcome, review.at));
    }
  }
  const characters = Object.fromEntries(Object.entries(data.characters).map(([character, state]) => {
    const schedule = schedules.get(character);
    const due = schedule ? schedule.due : state.due;
    return [character, {
      memorized: state.memorized,
      correctStreak: schedule?.correctStreak ?? 0,
      lastGrade: schedule?.lastGrade ?? null,
      introducedAt: data.version === 1 ? introduced.get(character) ?? null : state.introducedAt,
      due: state.memorized ? null : due,
      ...(state.memorized ? { pausedDue: due } : {}),
      ...(state.browserOnly ? { browserOnly: true } : {}),
    }];
  }));
  releaseMissedReviews(characters, orderedReviews);
  return { ...data, ...freshProgress(), newPerDay: validNewPerDay(data.newPerDay) ? data.newPerDay : 5,
    characters, reviews: data.reviews };
}

function validStreak(state) {
  return isCount(state.correctStreak) && state.correctStreak <= correctIntervals.length &&
    (state.correctStreak ? state.lastGrade === 'correct' : state.lastGrade === null || state.lastGrade === 'incorrect') &&
    (state.introducedAt === null || isDate(state.introducedAt)) &&
    (state.memorized ? state.due === null && (state.pausedDue === null || isDate(state.pausedDue)) :
      state.pausedDue === undefined && (isDate(state.due) || (state.due === null && state.lastGrade === 'incorrect'))) &&
    (state.browserOnly === undefined || (state.browserOnly === true && state.memorized &&
      state.introducedAt === null && state.lastGrade === null && state.pausedDue === null));
}

export function parseProgress(raw) {
  const data = JSON.parse(raw);
  const legacy = data?.version === 1;
  const statesValid = data?.characters && typeof data.characters === 'object' &&
    !Array.isArray(data.characters) && Object.entries(data.characters).every(([character, state]) =>
      isKanji(character) && state && typeof state.memorized === 'boolean' &&
      (data.version === 3 ? validStreak(state) : (state.memorized ? state.due === null : isDate(state.due)) &&
      (legacy ? isCount(state.level) && state.level <= 7 :
        (state.introducedAt === null || isDate(state.introducedAt)) && validCard(state.card) &&
        (state.browserOnly === undefined || (state.browserOnly === true &&
          state.memorized && state.card === null && state.introducedAt === null)))));
  const reviewsValid = Array.isArray(data?.reviews) && data.reviews.every(review =>
    review && typeof review.wordId === 'string' && isKanji(review.character) &&
    isDate(review.at) && outcomes.includes(review.outcome) &&
    (review.practice === undefined || (!legacy && review.practice === true)) &&
    (review.outcome === 'memorized' ? review.due === null :
      isDate(review.due) || (review.due === null &&
        (review.practice === true || (data.version === 3 && review.outcome === 'incorrect')))));
  if ((!legacy && (![2, 3].includes(data?.version) || !validNewPerDay(data.newPerDay))) || !statesValid || !reviewsValid) {
    throw new Error('Unrecognized progress data');
  }
  return data.version === 3 ? data : migrateLegacy(data);
}
