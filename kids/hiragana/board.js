import { clips } from './clips.js';

// Small kana tiles play their isolated base sound. Combined chart tiles have their own recording.
const smallSounds = Object.fromEntries([...'ぁぃぅぇぉゃゅょゎゕゖ'].map((kana, index) => [kana, 'あいうえおやゆよわかけ'[index]]));

const groups = [
  ['Basic sounds', ['あいうえお','かきくけこ','さしすせそ','たちつてと','なにぬねの','はひふへほ','まみむめも','や ゆ よ','らりるれろ','わ   を','ん']],
  ['Voiced sounds', ['がぎぐげご','ざじずぜぞ','だぢづでど','ばびぶべぼ','ぱぴぷぺぽ']],
  ['Combined sounds', [...'きしちにひみりぎじびぴ'].map(first => [...'ゃゅょ'].map(last => first + last))],
];

function makePlayer(report) {
  let context, pack, active, pending = [], generation = 0, busy = false;
  const decoded = new Map();

  async function bufferFor(kana) {
    if (decoded.has(kana)) return decoded.get(kana);
    if (kana === 'っ') {
      // Sokuon is a closure without an isolated voiced pronunciation.
      return { buffer: context.createBuffer(1, Math.round(context.sampleRate * 0.12), context.sampleRate), begin: 0, duration: 0.12 };
    }
    pack ??= fetch(new URL('./clips.bin', import.meta.url)).then(response => {
      if (!response.ok) throw Error('Audio unavailable');
      return response.arrayBuffer();
    }).catch(error => { pack = null; throw error; });
    const [offset, length] = clips[kana];
    const buffer = await context.decodeAudioData((await pack).slice(offset, offset + length));
    const samples = buffer.getChannelData(0);
    let start = 0, end = samples.length;
    while (start < end && Math.abs(samples[start]) < 0.001) start++;
    while (end > start && Math.abs(samples[end - 1]) < 0.001) end--;
    const begin = Math.max(0, start / buffer.sampleRate - 0.025);
    const duration = Math.min(buffer.duration, end / buffer.sampleRate + 0.035) - begin;
    const clip = { buffer, begin, duration };
    decoded.set(kana, clip);
    return clip;
  }

  function stop() {
    generation++;
    pending = [];
    busy = false;
    if (active) {
      active.button.classList.remove('sounding');
      active.source.onended = null;
      active.source.stop();
      active.source.disconnect();
      active = null;
    }
  }

  async function next() {
    if (busy || !pending.length) return;
    busy = true;
    const token = generation;
    const { button, ready } = pending.shift();
    try {
      await ready;
      const { buffer, begin, duration } = await bufferFor(button.dataset.sound);
      if (generation !== token) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        if (generation !== token) return;
        button.classList.remove('sounding');
        source.disconnect();
        active = null;
        busy = false;
        next();
      };
      active = { source, button };
      source.start(0, begin, duration);
      button.classList.add('sounding');
    } catch {
      if (generation !== token) return;
      stop();
      report.textContent = 'Sound could not play. Tap again to retry.';
    }
  }

  return { stop, play(button, queue) {
    if (!queue) stop();
    try {
      context ??= new (window.AudioContext || window.webkitAudioContext)();
      const ready = context.state === 'running' ? undefined : context.resume();
      ready?.catch(() => {}); // The queue handles the error when this tap reaches the front.
      pending.push({ button, ready });
      report.textContent = '';
      next();
    } catch {
      report.textContent = 'Audio playback is unavailable on this device.';
    }
  }};
}

export function setupHiragana(root) {
  const input = root.querySelector('input');
  const board = root.querySelector('.kana-board');
  const report = root.querySelector('[role=status]');
  const player = makePlayer(report);
  let previous, composing = false;

  function tile(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.lang = 'ja';
    button.textContent = label;
    button.className = 'kana-key';
    button.dataset.sound = smallSounds[label] || label;
    button.disabled = !clips[button.dataset.sound] && label !== 'っ';
    return button;
  }

  function render() {
    if (previous === input.value) return;
    previous = input.value;
    player.stop();
    board.replaceChildren();
    report.textContent = '';
    if (input.value) {
      const row = document.createElement('div');
      row.className = 'kana-sequence';
      const buttons = [...input.value.normalize('NFC')].map(tile);
      row.append(...buttons);
      board.append(row);
      const tips = [];
      if (buttons.some(button => smallSounds[button.textContent])) tips.push('Small kana play their sound on its own. Tap a combined tile in the chart to hear the pair.');
      if (input.value.includes('っ')) tips.push('Small っ makes a short pause.');
      if (buttons.some(button => button.disabled)) tips.push('Faded characters have no recording.');
      report.textContent = tips.join(' ');
      return;
    }
    for (const [name, rows] of groups) {
      const title = document.createElement('h3');
      title.textContent = name;
      board.append(title);
      for (const row of rows) {
        const line = document.createElement('div');
        line.className = 'kana-row';
        for (const kana of row) line.append(kana === ' ' ? document.createElement('span') : tile(kana));
        board.append(line);
      }
    }
  }

  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; render(); });
  input.addEventListener('input', event => { if (!composing && !event.isComposing) render(); });
  board.addEventListener('click', event => {
    const button = event.target.closest('button[data-sound]');
    if (button && !button.disabled) player.play(button, Boolean(previous));
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.stop(); });
  window.addEventListener('pagehide', player.stop);
  return { open: render, stop: player.stop };
}
