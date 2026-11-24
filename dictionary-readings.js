export function splitKunReading(reading) {
  const [stem, okurigana = ''] = reading.split('.');
  return { stem, okurigana };
}

export function appendDictionaryReadings(container, reference, headingTag) {
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
