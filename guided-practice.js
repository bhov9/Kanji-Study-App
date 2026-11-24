import { loadPaths, svgElement } from './stroke-order.js';

const sampleCount = 16;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Compare evenly spaced points so the result does not depend on drawing speed.
function matchesStroke(points, path) {
  const referenceLength = path.getTotalLength();
  if (points.length < 2 || referenceLength <= 0) return false;
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]));
  }
  const drawnLength = lengths.at(-1);
  if (drawnLength < referenceLength * .48 || drawnLength > referenceLength * 2 + 8) return false;

  const tolerance = Math.min(14, 7 + referenceLength * .16);
  let segment = 1;
  let error = 0;
  let reverseError = 0;
  for (let sample = 0; sample <= sampleCount; sample++) {
    const fraction = sample / sampleCount;
    const offset = fraction * drawnLength;
    while (lengths[segment] < offset && segment < points.length - 1) segment++;
    const span = lengths[segment] - lengths[segment - 1];
    const weight = span ? (offset - lengths[segment - 1]) / span : 0;
    const start = points[segment - 1];
    const end = points[segment];
    const point = { x: start.x + (end.x - start.x) * weight, y: start.y + (end.y - start.y) * weight };
    const deviation = distance(point, path.getPointAtLength(fraction * referenceLength));
    if (deviation > tolerance * (sample === 0 || sample === sampleCount ? 1 : 1.8)) return false;
    error += deviation;
    reverseError += distance(point, path.getPointAtLength((1 - fraction) * referenceLength));
  }
  return error / (sampleCount + 1) <= tolerance * .75 && error < reverseError;
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function control(text, action) {
  const button = element('button', text);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

function positionMarker(marker, point) {
  marker.setAttribute('cx', point.x);
  marker.setAttribute('cy', point.y);
}

async function prepareBox(box, character, panel) {
  const status = element('p', 'Loading tracing guide…', 'guided-status');
  status.setAttribute('role', 'status');
  box.append(status);
  const data = await loadPaths(character);
  if (!data?.length) throw new Error('No tracing data');
  if (!box.isConnected) return;

  const board = svgElement('svg', {
    viewBox: '0 0 109 109', role: 'img', 'aria-label': `Tracing box for ${character}`,
    class: 'stroke-guide guided-board',
  });
  const paths = data.map(d => svgElement('path', { d }));
  const finger = svgElement('path', { class: 'guided-finger' });
  const arrow = svgElement('polygon', { points: '-4,-3 4,0 -4,3', class: 'guided-arrow' });
  const dot = svgElement('circle', { r: 3.2, class: 'guided-dot' });
  const demo = svgElement('circle', { r: 3.5, class: 'guided-demo', hidden: '' });
  board.append(...paths, arrow, dot, demo, finger);
  const count = element('p', '', 'stroke-counter');
  const controls = element('div', '', 'stroke-controls');
  let next = 0;
  let active;
  let frame = 0;

  function stopDemo() {
    cancelAnimationFrame(frame);
    demo.setAttribute('hidden', '');
  }

  function clearFinger() {
    const pointer = active?.pointer;
    active = undefined;
    finger.removeAttribute('d');
    if (pointer !== undefined && board.hasPointerCapture(pointer)) board.releasePointerCapture(pointer);
  }

  function refresh(message = '') {
    stopDemo();
    clearFinger();
    const path = paths[next];
    paths.forEach((stroke, index) => {
      stroke.setAttribute('class', index < next ? 'stroke-ink' : index === next ? 'guided-next' : 'stroke-trace');
    });
    for (const marker of [dot, arrow]) marker.toggleAttribute('hidden', !path);
    if (path) {
      const length = path.getTotalLength();
      const start = path.getPointAtLength(0);
      const direction = path.getPointAtLength(Math.min(length, 12));
      const angle = Math.atan2(direction.y - start.y, direction.x - start.x) * 180 / Math.PI;
      positionMarker(dot, start);
      arrow.setAttribute('transform', `translate(${direction.x} ${direction.y}) rotate(${angle})`);
    }
    count.textContent = path ? `Stroke ${next + 1} / ${paths.length}` : `${paths.length} / ${paths.length} strokes`;
    status.textContent = message || (path ? 'Trace from the dot in the arrow direction.' : 'Character complete.');
    show.disabled = skip.disabled = !path;
    undo.disabled = next === 0;
  }

  function demonstrate() {
    stopDemo();
    clearFinger();
    const path = paths[next];
    const length = path.getTotalLength();
    const started = performance.now();
    demo.removeAttribute('hidden');
    status.textContent = 'Watch the red dot, then trace the stroke.';
    function draw(now) {
      if (!panel.open || !box.isConnected) return stopDemo();
      const fraction = Math.min(1, (now - started) / 800);
      positionMarker(demo, path.getPointAtLength(length * fraction));
      if (fraction < 1) frame = requestAnimationFrame(draw);
    }
    draw(started);
  }

  const show = control('Show Next Stroke', demonstrate);
  const skip = control('Skip Stroke', () => { next++; refresh('Stroke skipped.'); });
  const undo = control('Undo', () => { next--; refresh(); });
  const restart = control('Practice Again', () => { next = 0; refresh(); });
  controls.append(show, skip, undo, restart);
  box.append(board, count, status, controls);

  function record(event) {
    const point = board.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    active.points.push(point.matrixTransform(board.getScreenCTM().inverse()));
    const last = active.points.at(-1);
    active.line += `${active.points.length === 1 ? 'M' : 'L'}${last.x} ${last.y}`;
    finger.setAttribute('d', active.line);
  }

  board.addEventListener('pointerdown', event => {
    if (active || event.button !== 0 || next === paths.length) return;
    stopDemo();
    active = { pointer: event.pointerId, points: [], line: '' };
    board.setPointerCapture(event.pointerId);
    record(event);
  });
  board.addEventListener('pointermove', event => {
    if (active?.pointer === event.pointerId) record(event);
  });
  board.addEventListener('pointerup', event => {
    if (active?.pointer !== event.pointerId) return;
    record(event);
    const accepted = matchesStroke(active.points, paths[next]);
    if (accepted) next++;
    refresh(accepted ? '' : 'Try again. Start at the dot and follow the highlighted stroke.');
  });
  for (const type of ['pointercancel', 'lostpointercapture']) {
    board.addEventListener(type, event => {
      if (active?.pointer === event.pointerId) clearFinger();
    });
  }
  panel.addEventListener('toggle', () => {
    if (!panel.open) {
      stopDemo();
      clearFinger();
    }
  });
  refresh();
}

export function createGuidedPractice(character) {
  const panel = element('details', '', 'guided-practice');
  const boxes = element('div', '', 'guided-boxes');
  const credit = element('p', '', 'stroke-credit');
  const source = element('a', 'KanjiVG');
  source.href = 'https://kanjivg.tagaini.net/';
  const license = element('a', 'CC BY-SA 3.0');
  license.href = 'https://creativecommons.org/licenses/by-sa/3.0/';
  credit.append(source, ' © Ulrich Apel · ', license);
  panel.append(element('summary', 'Guided Writing'), boxes, credit);
  panel.addEventListener('toggle', () => {
    if (!panel.open || boxes.childElementCount) return;
    const box = element('section', '', 'stroke-content');
    box.addEventListener('contextmenu', event => event.preventDefault());
    const title = element('h4', character, 'stroke-title');
    title.lang = 'ja';
    box.setAttribute('aria-label', `Practice ${character}`);
    box.append(title);
    boxes.append(box);
    prepareBox(box, character, panel).catch(() => {
      box.querySelector('.guided-status').textContent = 'Tracing data is unavailable for this character.';
    });
  });
  return panel;
}
