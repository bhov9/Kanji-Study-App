import { setupDictionary } from './dictionary.js';
import { words } from './data.js';
import { exampleFor } from './examples.js';

const byId = id => document.getElementById(id);
const key = id => 'kanji-practice.vocabulary.known.' + id;
function element(tag, text) {
  const el = document.createElement(tag);
  el.textContent = text;
  return el;
}

function details(word, container) {
  container.replaceChildren(element('h3', word.spelling), element('p', word.reading + ' · ' + word.meaning));
  if (word.senses?.length) {
    const senses = element('ol', '');
    for (const sense of word.senses) {
      const item = element('li', sense.glosses.join('; '));
      const labels = [...sense.pos, ...sense.labels];
      if (labels.length) item.append(element('small', labels.join(' · ')));
      senses.append(item);
    }
    container.append(senses);
  }
  if (word.verifiedParts) {
    container.append(element('p', [...word.spelling].map((c,i) =>
      c === word.verifiedParts[i] ? c : c + '（' + word.verifiedParts[i] + '）').join(' ')));
  }
  const priority = word.dictionaryPriority;
  if (priority?.frequencyBand) container.append(element('p', 'JMdict newspaper frequency band · ' + priority.frequencyBand));
  if (priority?.usageFlags.length) container.append(element('p', priority.usageFlags.join(' · ')));
  if (word.jmdictId) container.append(element('small', 'JMdict entry ' + word.jmdictId));
  const example = exampleFor(word.id);
  if (example) {
    container.append(element('p', example.parts.map(p => typeof p === 'string' ? p : p.target ? word.spelling : p.ruby).join('')),
      element('p', example.translation));
  }
}

export function setupVocabulary(openKanji) {
  const openDictionary = setupDictionary(openKanji);
  let queue = [];
  let current;
  const known = new Set();
  const read = () => {
    try {
      known.clear();
      for (const word of words) if (localStorage.getItem(key(word.id)) === '1') known.add(word.id);
    } catch { byId('vocab-status').textContent = 'Vocabulary progress storage is unavailable.'; }
  };
  const counts = () => {
    byId('vocab-coverage').textContent = words.length.toLocaleString() + ' study words · ' + known.size.toLocaleString() + ' marked known';
  };
  function showDetails(word, container) {
    details(word, container);
    for (const char of word.characters) {
      const button = element('button', char);
      button.setAttribute('aria-label', 'Kanji details · ' + char);
      button.onclick = () => openKanji(char);
      container.append(button);
    }
  }
  function draw() {
    current = queue.shift();
    byId('vocab-front').textContent = current?.spelling ?? 'Session complete';
    byId('vocab-answer').replaceChildren();
    byId('vocab-answer').hidden = true;
    byId('vocab-grade').hidden = true;
    byId('vocab-reveal').hidden = !current;
    counts();
  }
  function grade(remembered) {
    if (!current) return;
    try {
      if (remembered) { localStorage.setItem(key(current.id), '1'); known.add(current.id); }
      else { localStorage.removeItem(key(current.id)); known.delete(current.id); queue.push(current); }
    } catch { byId('vocab-status').textContent = 'Could not save vocabulary progress. Please retry.'; return; }
    draw();
  }
  byId('vocab-study').onclick = () => {
    const unknown = words.filter(w => !known.has(w.id));
    const pool = [...(unknown.length ? unknown : words)];
    queue = [];
    while (pool.length && queue.length < 10) queue.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    byId('vocab-browse').hidden = true;
    byId('vocab-session').hidden = false;
    draw();
  };
  byId('vocab-reveal').onclick = () => {
    showDetails(current, byId('vocab-answer'));
    byId('vocab-answer').hidden = false;
    byId('vocab-grade').hidden = false;
    byId('vocab-reveal').hidden = true;
  };
  byId('vocab-again').onclick = () => grade(false);
  byId('vocab-known').onclick = () => grade(true);
  function browse() {
    read(); counts(); openDictionary();
    byId('vocab-browse').hidden = false;
    byId('vocab-session').hidden = true;
  }
  byId('vocab-export').onclick = () => {
    read();
    const blob = new Blob([JSON.stringify({ type: 'kanji-practice.vocabulary', known: [...known] })], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = element('a', '');
    a.href = url;
    a.download = 'vocabulary-known.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  byId('vocab-import').onclick = () => byId('vocab-file').click();
  byId('vocab-file').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const saved = JSON.parse(await file.text());
      const ids = new Set(words.map(w => w.id));
      if (saved.type !== 'kanji-practice.vocabulary' || !Array.isArray(saved.known) ||
          saved.known.some(id => !ids.has(id))) throw new Error();
      for (const id of saved.known) localStorage.setItem(key(id), '1');
      byId('vocab-status').textContent = 'Imported known words.';
    } catch { byId('vocab-status').textContent = 'Could not import known words. Check the backup and device storage.'; }
    browse();
  };
  byId('vocab-end').onclick = browse;
  return browse;
}
