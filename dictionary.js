import { curriculumGrades } from './curriculum.js';

const base = './dictionary/3.6.2+20261123231529/';
const maxResults = 12;
const normalize = text => text.normalize('NFKC').trim().toLowerCase()
  .replace(/[ァ-ヶ]/gu, c => String.fromCharCode(c.charCodeAt(0) - 96));
const byId = id => document.getElementById(id);
function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}
async function read(name) {
  const response = await fetch(base + name);
  if (!response.ok) throw new Error('Dictionary data unavailable');
  if (name.endsWith('.json')) return response.json();
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).json();
}
// Keep only recent decoded shards in memory. The service worker stores the compressed copies.
const recent = new Map();
function shard(name) {
  if (recent.has(name)) {
    const hit = recent.get(name);
    recent.delete(name);
    recent.set(name,hit);
  } else {
    if (recent.size >= 16) recent.delete(recent.keys().next().value);
    const request = read(name).catch(error => {
      if (recent.get(name) === request) recent.delete(name);
      throw error;
    });
    recent.set(name, request);
  }
  return recent.get(name);
}

export function suggest(rows, term) {
  const scores = new Map();
  for (const [key, postings] of rows) {
    if (!key.startsWith(term)) continue;
    for (const packed of postings) {
      const id = Math.floor(packed / 6);
      const type = Math.floor((packed % 6) / 2);
      const tier = type === 0 ? (key === term ? 0 : 1) :
        type === 1 ? (key === term ? 2 : 3) : 4;
      const score = tier * 2 + packed % 2;
      if (score < (scores.get(id) ?? Infinity)) scores.set(id, score);
    }
  }
  return [...scores].sort((a,b) => a[1]-b[1] || a[0]-b[0]).slice(0,maxResults).map(([id]) => id);
}

export function setupDictionary(openKanji) {
  const input = byId('vocab-search');
  const list = byId('vocab-list');
  const resultView = byId('dict-results');
  const entryView = byId('dict-entry');
  const status = byId('vocab-range');
  let manifest, generation = 0, composing = false, timer, selected;
  const label = tag => manifest.tags[tag] ?? tag;
  function render(entry) {
    const content = byId('dict-content');
    const primary = entry.kanji[0]?.text ?? entry.kana[0].text;
    content.replaceChildren(el('h3', primary));
    function field(title, lines) {
      if (!lines.length) return;
      content.append(el('h4', title), ...lines.map(line => el('p',line)));
    }
    function restrictions(list, prefix) {
      return list?.length && !list.includes('*') ? prefix + list.join('、') : '';
    }
    function formText(form) {
      const notes = [...form.tags.map(label), form.common ? 'common (JMdict)' : '',
        restrictions(form.appliesToKanji, 'applies to ')];
      return [form.text,...notes.filter(Boolean)].join(' · ');
    }
    field('Spellings', entry.kanji.map(formText));
    field('Readings', entry.kana.map(formText));
    content.append(el('h4','English senses'));
    const senses = el('ol','');
    for (const s of entry.sense) {
      const item = el('li', s.gloss.filter(g => g.lang === 'eng').map(g =>
        g.type ? g.text + ' (' + label(g.type) + ')' : g.text).join('; '));
      const notes = [...s.partOfSpeech,...s.field,...s.misc,...s.dialect].map(label);
      notes.push(restrictions(s.appliesToKanji,'spelling: '),restrictions(s.appliesToKana,'reading: '),...s.info);
      if (notes.some(Boolean)) item.append(el('small',notes.filter(Boolean).join(' · ')));
      senses.append(item);
    }
    content.append(senses);
    const chars = new Set(entry.kanji.flatMap(f => [...f.text].filter(c => /\p{Script=Han}/u.test(c))));
    if (chars.size) content.append(el('h4','Kanji'));
    for (const c of chars) {
      const button = el('button',c);
      button.onclick = () => {
        if (curriculumGrades.has(c)) openKanji(c);
        else { input.value = c; resultView.hidden = false; entryView.hidden = true; search(); input.focus(); }
      };
      content.append(button);
    }
    content.append(el('p','JMdict entry ' + entry.id));
    resultView.hidden = true; entryView.hidden = false;
    byId('dict-back').focus();
  }
  function showResults() {
    entryView.hidden = true; resultView.hidden = false;
  }
  async function search() {
    const seq = ++generation;
    list.replaceChildren();
    const term = normalize(input.value);
    if (!term) { status.textContent = ''; return; }
    status.textContent = 'Searching…';
    try {
      manifest ??= await shard('manifest.json');
      const rows = await shard('s' + (term.codePointAt(0) % manifest.buckets) + '.bin');
      if (seq !== generation) return;
      const ids = suggest(rows,term);
      const results = await Promise.all(ids.map(async id => {
        const batch = await shard('p' + Math.floor(id/manifest.size) + '.bin');
        return batch[id % manifest.size];
      }));
      if (seq !== generation) return;
      list.replaceChildren(...results.map(([forms, readings, gloss], index) => {
        const written = forms.find(f => normalize(f) === term) ?? forms.find(f => normalize(f).startsWith(term));
        const reading = readings.find(([k]) => normalize(k) === term) ??
          readings.find(([k]) => normalize(k).startsWith(term)) ??
          readings.find(([, allowed]) => !written || allowed.includes('*') || allowed.includes(written)) ?? readings[0];
        const spelling = written ?? forms.find(f => reading[1].includes('*') || reading[1].includes(f)) ?? reading[0];
        const button = el('button',spelling + (spelling === reading[0] ? '' : ' · ' + reading[0]));
        button.append(el('small',gloss));
        button.onclick = async () => {
          const request = ++generation;
          selected = button;
          const id = ids[index];
          try {
            const batch = await shard('e' + Math.floor(id/manifest.size) + '.bin');
            if (request === generation) render(batch[id % manifest.size]);
          } catch {
            if (request === generation) status.textContent = 'Entry unavailable. Reconnect to finish the offline download.';
          }
        };
        return button;
      }));
      status.textContent = results.length ? 'Suggestions' : 'No matching entries';
    } catch {
      if (seq === generation) status.textContent = 'Dictionary unavailable. Reopen online to finish saving the offline dictionary, then try again.';
    }
  }
  function schedule() {
    clearTimeout(timer); generation++;
    list.replaceChildren();
    if (!composing) timer = setTimeout(search,90);
  }
  input.addEventListener('compositionstart', () => { composing = true; schedule(); });
  input.addEventListener('compositionend', () => { composing = false; schedule(); });
  input.addEventListener('input', schedule);
  byId('dict-back').onclick = () => { showResults(); (selected?.isConnected ? selected : input).focus(); };
  return () => { showResults(); search(); };
}
