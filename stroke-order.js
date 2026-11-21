const svgNamespace = 'http://www.w3.org/2000/svg';
const strokeMs = 650;
const pauseMs = 90;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

export function svgElement(tag, attributes) {
  const node = document.createElementNS(svgNamespace, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

export async function loadPaths(character) {
  const shard = (character.codePointAt(0) % 32).toString(16).padStart(2, '0');
  const response = await fetch(new URL(`./stroke-data/${shard}.json`, import.meta.url));
  if (!response.ok) throw new Error('Stroke data unavailable');
  return (await response.json())[character];
}

export function createStrokeOrder(character) {
  const panel = element('details', '', 'stroke-order');
  const summary = element('summary', 'Stroke Order');
  const content = element('div', '', 'stroke-content');
  const title = element('p', '', 'stroke-title');
  const figure = svgElement('svg', { viewBox: '0 0 109 109', role: 'img', 'aria-label': `Writing demonstration for ${character}` });
  figure.classList.add('stroke-guide');
  const counter = element('p', '', 'stroke-counter');
  const controls = element('div', '', 'stroke-controls');
  const replay = element('button', 'Replay');
  const close = element('button', 'Close Stroke Order');
  const credit = element('p', '', 'stroke-credit');
  const source = element('a', 'KanjiVG');
  source.href = 'https://kanjivg.tagaini.net/';
  const license = element('a', 'CC BY-SA 3.0');
  license.href = 'https://creativecommons.org/licenses/by-sa/3.0/';
  credit.append(source, ' © Ulrich Apel · ', license);
  replay.type = close.type = 'button';
  replay.disabled = true;
  figure.setAttribute('hidden', '');
  controls.append(replay, close);
  content.append(title, figure, counter, controls, credit);
  panel.append(summary, content);

  let loading;
  let frame = 0;
  let paths = [];
  let shown = -1;

  function prepare(data) {
    if (!data?.length) throw new Error('No data for this character');
    const guide = svgElement('g', { class: 'stroke-trace' });
    const ink = svgElement('g', { class: 'stroke-ink' });
    paths = data.map(d => {
      guide.append(svgElement('path', { d }));
      return svgElement('path', { d });
    });
    ink.append(...paths);
    figure.append(guide, ink);
    title.textContent = `${character} — ${paths.length} ${paths.length === 1 ? 'stroke' : 'strokes'}`;
    figure.removeAttribute('hidden');
    replay.disabled = false;
  }

  function play() {
    cancelAnimationFrame(frame);
    if (!paths.length) return;
    const lengths = paths.map(path => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length} ${length}`;
      path.style.strokeDashoffset = length;
      path.style.visibility = 'hidden';
      return length;
    });
    const started = performance.now();
    const step = strokeMs + pauseMs;
    shown = -1;
    function draw(timestamp) {
      if (!panel.open || !panel.isConnected) return;
      const elapsed = Math.max(0, timestamp - started);
      const current = Math.min(paths.length - 1, Math.floor(elapsed / step));
      if (current !== shown) {
        for (let index = shown + 1; index < current; index++) {
          paths[index].style.visibility = 'visible';
          paths[index].style.strokeDashoffset = '0';
        }
        if (shown >= 0) paths[shown].style.strokeDashoffset = '0';
        paths[current].style.visibility = 'visible';
        counter.textContent = `Stroke ${current + 1} / ${paths.length}`;
        shown = current;
      }
      const fraction = Math.min(1, (elapsed - current * step) / strokeMs);
      paths[current].style.strokeDashoffset = lengths[current] * (1 - fraction);
      if (current < paths.length - 1 || fraction < 1) frame = requestAnimationFrame(draw);
    }
    draw(started);
  }

  panel.addEventListener('toggle', async () => {
    cancelAnimationFrame(frame);
    if (!panel.open) return;
    if (!loading) {
      title.textContent = 'Loading stroke order…';
      loading = loadPaths(character).then(prepare).catch(() => {
        loading = undefined;
        title.textContent = 'Stroke-order animation unavailable for this character.';
      });
    }
    await loading;
    if (panel.open && panel.isConnected) play();
  });
  replay.addEventListener('click', play);
  close.addEventListener('click', () => {
    panel.open = false;
    summary.focus();
  });
  return panel;
}
