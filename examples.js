// Each word ID can have multiple reviewed examples. A target slot uses the
// deck's reading before reveal and its spelling afterwards.
export const examplesByWord = {
  yakusoku: [{
    parts: ['二人は、明日また会うと', { target: true }, 'しました。'],
    translation: 'The two promised to meet again tomorrow.',
    verification: 'reviewed',
  }],
  kazan: [{
    parts: [
      { ruby: '観測所', reading: 'かんそくじょ' }, 'では、', { target: true },
      'の', { ruby: '活動', reading: 'かつどう' }, 'を', { ruby: '調', reading: 'しら' }, 'べています。',
    ],
    translation: 'At the observatory, researchers study volcanic activity.',
    verification: 'reviewed',
  }],
  gakkou: [{
    parts: [
      { ruby: '明治', reading: 'めいじ' }, 'のはじめ、', { ruby: '全国', reading: 'ぜんこく' },
      'に', { target: true }, 'をつくるためのきまりができました。',
    ],
    translation: 'Early in the Meiji era, a system was established to set up schools throughout Japan.',
    historicalNote: 'In 1872, the Meiji government promulgated the Gakusei, its first nationwide education system.',
    sources: [{
      title: 'MEXT · The promulgation of the Gakusei',
      url: 'https://www.mext.go.jp/b_menu/hakusho/html/others/detail/mext_03459.html',
    }],
    verification: 'source-checked',
  }],
};

export function exampleFor(wordId) {
  return examplesByWord[wordId]?.find(example =>
    example.verification === 'reviewed' || example.verification === 'source-checked');
}

export function renderExample(container, example, word, revealed) {
  const sentence = container.querySelector('.example-japanese');
  sentence.replaceChildren();
  if (example) {
    for (const part of example.parts) {
      if (typeof part === 'string') {
        sentence.append(part);
      } else if (part.target) {
        const target = document.createElement(revealed ? 'span' : 'u');
        target.className = 'example-target';
        target.textContent = revealed ? word.spelling : word.reading;
        sentence.append(target);
      } else {
        const ruby = document.createElement('ruby');
        const reading = document.createElement('rt');
        reading.textContent = part.reading;
        ruby.append(part.ruby, reading);
        sentence.append(ruby);
      }
    }
  }
  const translation = container.querySelector('.example-translation');
  const context = container.querySelector('.example-history');
  if (!revealed) translation.open = false;
  translation.hidden = !example?.translation;
  translation.querySelector('p').textContent = example?.translation ?? '';
  context.hidden = !revealed || !example?.historicalNote;
  context.open = false;
  context.querySelector('p').textContent = revealed ? example?.historicalNote ?? '' : '';
  const sources = context.querySelector('ul');
  sources.replaceChildren();
  for (const { title, url } of revealed ? example?.sources ?? [] : []) {
    const link = document.createElement('a');
    link.href = url;
    link.textContent = title;
    const item = document.createElement('li');
    item.append(link);
    sources.append(item);
  }
  container.hidden = !example;
}
