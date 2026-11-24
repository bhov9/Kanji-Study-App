import { curriculumGrades } from './curriculum.js';

const key = 'kanji-practice.feedback';
const maxLength = 10000;

export function unicodeId(character) {
  return 'U+' + character.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
}

export function validateFeedback(entries) {
  const ids = new Set();
  if (!Array.isArray(entries) || entries.some(entry => {
    if (!entry || typeof entry.id !== 'string' || !entry.id || ids.has(entry.id) ||
      typeof entry.text !== 'string' || !entry.text.trim() || entry.text.length > maxLength ||
      !Number.isFinite(new Date(entry.at).getTime()) || typeof entry.at !== 'string' ||
      !['Writing Screen', 'Browse Kanji'].includes(entry.page) ||
      (entry.character !== undefined && !curriculumGrades.has(entry.character)) ||
      ['word', 'reading'].some(field => entry[field] !== undefined && typeof entry[field] !== 'string')) return true;
    ids.add(entry.id);
    return false;
  })) throw new Error('Invalid feedback');
  // Keep only the supported fields from imported records.
  return entries.map(({ id, text, at, page, character, word, reading }) => ({
    id, text, at, page, character, word, reading,
    ...(character ? { kanjiId: character, unicode: unicodeId(character), grade: curriculumGrades.get(character) } : {}),
  }));
}

export function readFeedback() {
  return validateFeedback(JSON.parse(localStorage.getItem(key) ?? '[]'));
}

function writeFeedback(entries) {
  localStorage.setItem(key, JSON.stringify(validateFeedback(entries)));
}

// Both writes are synchronous under the app's progress lock. Restore the
// previous feedback if the progress write fails.
export function withRestoredFeedback(entries, saveProgress) {
  if (entries === undefined) return saveProgress();
  const previous = localStorage.getItem(key);
  writeFeedback(entries);
  try {
    return saveProgress();
  } catch (error) {
    if (previous === null) localStorage.removeItem(key);
    else localStorage.setItem(key, previous);
    throw error;
  }
}

function contextLabels({ character, page, word, reading }) {
  const grade = curriculumGrades.get(character);
  const labels = character
    ? ['Kanji', character, unicodeId(character), grade === 7 ? 'Remaining Jōyō' : `Grade ${grade}`, page]
    : ['General', page];
  if (word) labels.push(reading ? `${word}（${reading}）` : word);
  return labels;
}

export function formatFeedback(entries) {
  return entries.map((entry, index) =>
    `${index + 1}. [${contextLabels(entry).join(' | ')}]\n${entry.at}\n${entry.text}`).join('\n\n');
}

function node(tag, label) {
  const element = document.createElement(tag);
  element.textContent = label;
  return element;
}

function button(text, action) {
  const result = node('button', text);
  result.type = 'button';
  result.addEventListener('click', action);
  return result;
}

function editor(text, save) {
  const form = node('form', '');
  form.className = 'feedback-form';
  const label = node('label', 'Feedback text');
  const input = node('textarea', '');
  input.rows = 3;
  input.required = true;
  input.maxLength = maxLength;
  input.value = text;
  label.append(input);
  const submit = node('button', 'Save');
  submit.type = 'submit';
  const status = node('p', '');
  status.setAttribute('role', 'status');
  form.append(label, submit, status);
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      status.textContent = 'Enter feedback before saving.';
      return;
    }
    try {
      save(value);
      status.textContent = 'Feedback saved.';
    } catch {
      status.textContent = 'Feedback could not be saved. Your text is still here.';
    }
  });
  return form;
}

export function feedbackForm(context) {
  const form = editor('', text => {
    writeFeedback([...readFeedback(), { ...context, id: crypto.randomUUID(), at: new Date().toISOString(), text }]);
    form.reset();
  });
  return form;
}

export function characterFeedback(context) {
  const panel = node('details', '');
  panel.append(node('summary', 'Feedback'), feedbackForm(context));
  return panel;
}

export function setupFeedbackSummary() {
  const id = name => document.getElementById(name);
  const list = id('feedback-list');
  const status = id('feedback-status');
  const copy = id('copy-feedback');
  const clear = id('clear-feedback');
  const copyText = id('feedback-copy-text');
  const mutate = change => {
    writeFeedback(change(readFeedback()));
    render();
  };
  function render() {
    status.textContent = '';
    copyText.hidden = true;
    list.replaceChildren();
    copy.disabled = clear.disabled = true;
    let entries;
    try {
      entries = readFeedback();
    } catch {
      status.textContent = 'Saved feedback could not be read.';
      return;
    }
    copy.disabled = clear.disabled = !entries.length;
    if (!entries.length) status.textContent = 'No feedback saved yet.';
    for (const entry of entries) {
      const item = node('li', '');
      const heading = node('strong', contextLabels(entry).join(' · '));
      const time = node('p', new Date(entry.at).toLocaleString());
      const body = node('p', entry.text);
      body.className = 'feedback-text';
      const actions = node('div', '');
      actions.className = 'feedback-actions';
      const edit = button('Edit', () => {
        const form = editor(entry.text, text => mutate(items => items.map(item => item.id === entry.id ? { ...item, text } : item)));
        form.append(button('Cancel', () => {
          form.remove();
          edit.disabled = false;
          edit.focus();
        }));
        item.append(form);
        edit.disabled = true;
        form.querySelector('textarea').focus();
      });
      actions.append(edit, button('Delete', () => {
        try {
          mutate(items => items.filter(item => item.id !== entry.id));
        } catch {
          status.textContent = 'Feedback could not be deleted.';
        }
      }));
      item.append(heading, time, body, actions);
      list.append(item);
    }
  }
  copy.addEventListener('click', async () => {
    let text;
    try {
      text = formatFeedback(readFeedback());
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied all feedback.';
    } catch {
      if (!text) {
        status.textContent = 'Feedback could not be read.';
        return;
      }
      copyText.value = text;
      copyText.hidden = false;
      copyText.focus();
      copyText.select();
      status.textContent = 'Select and copy the feedback below.';
    }
  });
  clear.addEventListener('click', () => {
    if (!window.confirm('Clear all saved feedback?')) return;
    try {
      mutate(() => []);
    } catch {
      status.textContent = 'Feedback could not be cleared.';
    }
  });
  window.addEventListener('storage', event => {
    if ((event.key === key || event.key === null) && !id('feedback-view').hidden) render();
  });
  return render;
}
