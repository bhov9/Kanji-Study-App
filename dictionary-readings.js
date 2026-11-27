import { officialExamples } from './official-examples.js';

export function splitKunReading(reading) {
  const [stem, okurigana = ''] = reading.split('.');
  return { stem, okurigana };
}

export function appendDictionaryReadings(container, reference, headingTag, character) {
  const field = (title, text) => {
    const heading = document.createElement(headingTag);
    heading.textContent = title;
    const value = document.createElement('p');
    value.textContent = text;
    container.append(heading, value);
  };
  const official = officialExamples[character];
  if (official) {
    field('Stroke count', String(official.strokes));
    if (official.examples.length) {
      const panel = document.createElement('section');
      const heading = document.createElement(headingTag);
      heading.textContent = 'Official Jōyō readings and examples';
      panel.append(heading);
      for (const [reading, examples] of official.examples) {
        const line = document.createElement('p');
        line.lang = 'ja';
        line.textContent = reading + ' · ' + examples.join('、');
        panel.append(line);
      }
      container.append(panel);
    }
  }
  if (character === '十') field('Recommended study order', '1. じゅう (on) · 2. と (kun)');
  if (character === '井') field('Reading in context', '天井（てんじょう） · ショウ is voiced to じょう in this word.');
  const title = document.createElement(headingTag);
  title.textContent = 'Dictionary readings';
  container.append(title);
  for (const [title, readings] of [
    ['On’yomi', reference?.on], ['Kun’yomi', reference?.kun], ['Name readings (nanori)', reference?.names],
  ]) {
    if (!readings?.length) continue;
    const heading = document.createElement(headingTag);
    heading.textContent = title;
    const value = document.createElement('p');
    value.lang = 'ja';
    readings.forEach((reading, index) => {
      if (index) value.append('、');
      const { stem, okurigana } = splitKunReading(reading);
      value.append(stem);
      if (okurigana) {
        const suffix = document.createElement('span');
        suffix.className = 'okurigana';
        suffix.textContent = okurigana;
        value.append(suffix);
      }
    });
    container.append(heading, value);
  }
}
