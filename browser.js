import { groups, curriculumGrades } from './curriculum.js';
import { kanjiNotes, words } from './data.js';
import { kanjiReference } from './kanji-reference.js';

const statuses = {
  memorized: ['Memorized', '✓'],
  learning: ['Learning', '●'],
  unstarted: ['Not Started', '○'],
};
const reviewDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const vocabularyByKanji = new Map();
for (const word of words) {
  for (const character of word.characters) {
    if (!vocabularyByKanji.has(character)) vocabularyByKanji.set(character, []);
    vocabularyByKanji.get(character).push(word);
  }
}

function statusFor(state) {
  return state?.memorized ? 'memorized' : state ? 'learning' : 'unstarted';
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function statusLabel(status, text) {
  const label = element('span', text, `status-label ${status}`);
  const marker = element('span', statuses[status][1], 'status-marker');
  marker.setAttribute('aria-hidden', 'true');
  label.prepend(marker);
  return label;
}

export function setupKanjiBrowser(getProgress, canEdit, setMemorized) {
  const id = name => document.getElementById(name);
  const list = id('grade-groups');
  const grid = id('kanji-grid');
  const dialog = id('kanji-details');
  const action = id('detail-toggle');
  let group;
  let selected;
  let busy = false;

  for (const [status, [label]] of Object.entries(statuses)) {
    id('kanji-legend').append(statusLabel(status, label));
  }

  function countsFor(entry) {
    const counts = { memorized: 0, learning: 0, unstarted: 0 };
    const states = getProgress().characters;
    for (const character of entry.characters) counts[statusFor(states[character])]++;
    return counts;
  }

  function renderGroups() {
    list.replaceChildren(...groups.map(entry => {
      const button = element('button', '', 'grade-card');
      button.type = 'button';
      const summary = element('span', '', 'grade-card-heading');
      summary.append(element('strong', entry.label), element('span', `${entry.characters.length.toLocaleString()} kanji`));
      const counts = element('span', '', 'grade-counts');
      for (const [status, count] of Object.entries(countsFor(entry))) {
        counts.append(statusLabel(status, `${count.toLocaleString()} ${statuses[status][0]}`));
      }
      button.append(summary, counts);
      button.addEventListener('click', () => selectGrade(entry));
      return button;
    }));
  }

  function updateTile(tile) {
    const character = tile.dataset.kanji;
    const status = statusFor(getProgress().characters[character]);
    tile.dataset.status = status;
    tile.setAttribute('aria-label', `${character}, ${statuses[status][0]}`);
    tile.lastElementChild.textContent = statuses[status][1];
  }

  function selectGrade(entry, focus = true) {
    group = entry;
    list.hidden = Boolean(entry);
    id('grade-view').hidden = !entry;
    id('back-to-grades').hidden = !entry;
    const heading = id('browser-title');
    heading.textContent = entry?.label ?? 'Browse Kanji';
    id('browser-summary').textContent = entry ? `${entry.characters.length.toLocaleString()} kanji` :
      '2,136 Jōyō kanji across seven groups';
    if (entry) {
      grid.replaceChildren(...entry.characters.map(character => {
        const tile = element('button', '', 'kanji-tile');
        tile.type = 'button';
        tile.dataset.kanji = character;
        const glyph = element('span', character, 'tile-glyph');
        glyph.lang = 'ja';
        const marker = element('span', '', 'tile-marker');
        marker.setAttribute('aria-hidden', 'true');
        tile.append(glyph, marker);
        updateTile(tile);
        return tile;
      }));
    } else {
      grid.replaceChildren();
      renderGroups();
    }
    if (focus) {
      window.scrollTo(0, 0);
      heading.focus({ preventScroll: true });
    }
  }

  function updateDetailStatus() {
    const progress = getProgress();
    const state = progress.characters[selected];
    const status = statusFor(state);
    id('detail-status').replaceChildren(statusLabel(status, statuses[status][0]));
    action.textContent = status === 'memorized' ? 'Reactivate' : 'Mark Memorized';
    action.disabled = busy || !canEdit();
    const reviews = progress.reviews.filter(review => review.character === selected);
    let correct = 0;
    let incorrect = 0;
    let latest = 0;
    for (const review of reviews) {
      if (review.outcome === 'correct') correct++;
      if (review.outcome === 'incorrect') incorrect++;
      latest = Math.max(latest, review.at);
    }
    const stats = id('detail-review-stats');
    stats.replaceChildren();
    id('detail-no-reviews').hidden = reviews.length > 0;
    const rows = reviews.length ? [
      ['Reviews', reviews.length], ['Correct', correct], ['Incorrect', incorrect], ['Last reviewed', reviewDate.format(latest)],
    ] : [];
    if (state?.due != null && vocabularyByKanji.has(selected)) rows.push(['Next review', reviewDate.format(state.due)]);
    for (const [label, value] of rows) {
      const row = element('div', '');
      row.append(element('dt', label), element('dd', value));
      stats.append(row);
    }
    stats.hidden = !rows.length;
  }

  function addDetail(content, title, text, lang) {
    if (!text) return;
    const value = element('p', text);
    if (lang) value.lang = lang;
    content.append(element('h3', title), value);
  }

  function openDetails(character) {
    selected = character;
    id('detail-message').hidden = true;
    id('detail-kanji').textContent = character;
    id('detail-grade').textContent = groups[curriculumGrades.get(character) - 1].label;
    const content = id('detail-content');
    content.replaceChildren();
    const reference = kanjiReference[character];
    addDetail(content, 'Meanings', reference?.meanings.join(', '));
    addDetail(content, 'On readings', reference?.on.join('、'), 'ja');
    addDetail(content, 'Kun readings', reference?.kun.map(reading => reading.replace(/\.(.+)$/, '（$1）')).join('、'), 'ja');
    const examples = vocabularyByKanji.get(character);
    if (examples) {
      const items = element('ul', '', 'vocabulary-examples');
      for (const { spelling, reading, meaning } of examples) {
        const item = element('li', '');
        const japanese = element('span', `${spelling}（${reading}）`);
        japanese.lang = 'ja';
        item.append(japanese, document.createTextNode(` · ${meaning}`));
        items.append(item);
      }
      content.append(element('h3', 'Vocabulary'), items);
    } else {
      content.append(element('p', 'Vocabulary practice is not available for this kanji yet.', 'muted'));
    }
    const notes = kanjiNotes[character];
    if (notes) {
      const [components, structure, mnemonic] = notes;
      addDetail(content, 'Structural breakdown', components);
      content.append(element('p', structure));
      addDetail(content, 'Memory aid', mnemonic);
    }
    updateDetailStatus();
    dialog.showModal();
    dialog.scrollTop = 0;
  }

  grid.addEventListener('click', event => {
    const tile = event.target.closest('[data-kanji]');
    if (tile) openDetails(tile.dataset.kanji);
  });
  id('back-to-grades').addEventListener('click', () => selectGrade(null));
  action.addEventListener('click', async () => {
    const character = selected;
    busy = true;
    action.disabled = true;
    id('detail-message').hidden = true;
    const saved = await setMemorized(character, !getProgress().characters[character]?.memorized);
    busy = false;
    if (!saved && dialog.open) {
      id('detail-message').textContent = 'This change could not be saved. Please try again.';
      id('detail-message').hidden = false;
    }
    refresh();
  });

  function refresh() {
    if (group) {
      for (const tile of grid.children) updateTile(tile);
    } else {
      renderGroups();
    }
    if (dialog.open) updateDetailStatus();
  }

  return { open: () => selectGrade(null), refresh };
}
