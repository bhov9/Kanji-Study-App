import { clips } from './clips.js';

// Small kana tiles play their isolated base sound. Combined chart tiles have their own recording.
const smallSounds = Object.fromEntries([...'ぁぃぅぇぉゃゅょゎゕゖ'].map((kana, index) => [kana, 'あいうえおやゆよわかけ'[index]]));

const groups = [
  ['Basic sounds', ['あいうえお','かきくけこ','さしすせそ','たちつてと','なにぬねの','はひふへほ','まみむめも','や ゆ よ','らりるれろ','わ   を','ん']],
  ['Voiced sounds', ['がぎぐげご','ざじずぜぞ','だぢづでど','ばびぶべぼ','ぱぴぷぺぽ']],
  ['Combined sounds', [...'きしちにひみりぎじびぴ'].map(first => [...'ゃゅょ'].map(last => first + last))],
];

// A native media element uses the device's media playback route. Decode only to
// trim the recordings; the offline context never drives the speaker or the UI.
function waveURL(samples, rate) {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const tag = (at, name) => [...name].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  tag(0, 'RIFF');
  view.setUint32(4, bytes.byteLength - 8, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true));
  return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
}

async function prepareSounds() {
  const response = await fetch(new URL('./clips.bin', import.meta.url));
  if (!response.ok) throw Error('Sound pack unavailable');
  const pack = await response.arrayBuffer();
  const decoder = new OfflineAudioContext(1, 1, 44100);
  const sounds = new Map();
  try {
    for (const [kana, [offset, length]] of Object.entries(clips)) {
      const buffer = await decoder.decodeAudioData(pack.slice(offset, offset + length));
      const samples = buffer.getChannelData(0);
      let start = 0, end = samples.length;
      while (start < end && Math.abs(samples[start]) < 0.001) start++;
      while (end > start && Math.abs(samples[end - 1]) < 0.001) end--;
      if (start === end) throw Error('Empty recording');
      start = Math.max(0, start - Math.ceil(buffer.sampleRate * 0.025));
      end = Math.min(samples.length, end + Math.ceil(buffer.sampleRate * 0.035));
      sounds.set(kana, waveURL(samples.subarray(start, end), buffer.sampleRate));
    }
    sounds.set('っ', waveURL(new Float32Array(5292), 44100));
    return sounds;
  } catch (error) {
    for (const url of sounds.values()) URL.revokeObjectURL(url);
    throw error;
  }
}

function makePlayer(report, board) {
  const media = new Audio();
  media.preload = 'auto';
  let sounds, loading, active, timer;
  const queue = [];

  function highlight(on) {
    for (const tile of active?.tiles ?? []) tile.classList.toggle('sounding', on);
  }

  function stop() {
    clearTimeout(timer);
    queue.length = 0;
    highlight(false);
    active = null;
    media.pause();
  }

  function fail() {
    stop();
    report.textContent = 'Sound stopped or could not play. Tap a sound to try again.';
  }

  function next() {
    clearTimeout(timer);
    active = queue.shift();
    if (!active) return;
    const item = active;
    const url = sounds.get(item.sound);
    media.src = url;
    const attempt = ++serial;
    timer = setTimeout(fail, 4000);
    // On the first tap this runs directly in the gesture. Reuse the same
    // element for every queued sound so iOS keeps its playback permission.
    try {
      media.play().catch(() => { if (active === item && serial === attempt) fail(); });
    } catch { fail(); }
  }

  let serial = 0;
  media.onplaying = () => {
    if (!active || media.paused || media.currentSrc !== sounds.get(active.sound)) return;
    highlight(true);
    clearTimeout(timer);
    timer = setTimeout(fail, Math.ceil(media.duration * 1000) + 1250);
  };
  media.onended = () => {
    if (!active || !media.ended) return;
    highlight(false);
    next();
  };
  media.onerror = () => { if (active && media.error) fail(); };
  media.onpause = () => { if (active && media.paused && !media.ended) fail(); };
  media.onwaiting = () => { highlight(false); };

  async function prepare() {
    if (sounds || loading) return;
    loading = true;
    board.inert = true;
    report.textContent = 'Loading sounds…';
    try {
      sounds = await prepareSounds();
      if (report.textContent === 'Loading sounds…') report.textContent = '';
    } catch {
      report.textContent = 'Sounds could not load. Connect once while online, then tap a tile to reload.';
    } finally {
      loading = false;
      board.inert = false;
    }
  }

  return { stop, prepare, play(items, append) {
    if (!sounds) { prepare(); return; }
    if (!append) stop();
    report.textContent = '';
    for (const item of items) queue.push(item);
    if (!active) next();
  }};
}

export function setupHiragana(root) {
  const input = root.querySelector('input');
  const board = root.querySelector('.kana-board');
  const report = root.querySelector('[role=status]');
  const player = makePlayer(report, board);
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
      const play = document.createElement('button');
      play.type = 'button';
      play.className = 'primary';
      play.textContent = '▶ Play';
      play.setAttribute('aria-label', 'Play sequence');
      play.disabled = buttons.every(button => button.disabled);
      play.addEventListener('click', () => {
        const items = [];
        for (let i = 0; i < buttons.length; i++) {
          const first = buttons[i], second = buttons[i + 1];
          if (first.disabled) continue;
          const pair = first.textContent + (second?.textContent ?? '');
          if (second && clips[pair]) {
            items.push({ sound: pair, tiles: [first, second] });
            i++;
          } else {
            items.push({ sound: first.dataset.sound, tiles: [first] });
          }
        }
        player.play(items, false);
      });
      board.append(play, row);
      const tips = [];
      if (buttons.some(button => smallSounds[button.textContent])) tips.push('Tap a small kana to hear it alone. Play uses the combined recording when available.');
      if (input.value.includes('っ')) tips.push('Small っ makes a short pause.');
      if (buttons.some(button => button.disabled)) tips.push('Play skips faded characters with no recording.');
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
    if (button && !button.disabled) player.play([{ sound: button.dataset.sound, tiles: [button] }], Boolean(previous));
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.stop(); });
  window.addEventListener('pagehide', player.stop);
  return { open() { render(); player.prepare(); }, stop: player.stop };
}
