import { groups } from './curriculum.js';
import { unlockedGrade } from './study.js';

export function setupProgressEditor(getProgress, canEdit, saveChanges) {
  const id = name => document.getElementById(name);
  const open = id('open-progress-editor');
  const dialog = id('edit-progress');
  const grades = id('edit-grade');
  const grid = id('edit-kanji-grid');
  const confirm = id('confirm-progress-edits');
  const cancel = id('cancel-progress-edits');
  const close = id('close-progress-editor');
  const markAll = id('edit-mark-all');
  const unmarkAll = id('edit-unmark-all');
  const changes = new Map();
  let original = {};
  let saving = false;

  for (const group of groups) {
    const option = document.createElement('option');
    option.value = group.grade;
    option.textContent = group.label;
    grades.append(option);
  }

  const selectedGrade = () => groups[Number(grades.value) - 1];
  const originalStatus = character => Boolean(original[character]?.memorized);
  const status = character => changes.get(character) ?? originalStatus(character);

  function setStatus(character, memorized) {
    if (memorized === originalStatus(character)) changes.delete(character);
    else changes.set(character, memorized);
  }

  function warnBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = true;
  }

  function updateCount() {
    const count = changes.size;
    id('edit-change-count').textContent = `${count.toLocaleString()} unsaved ${count === 1 ? 'change' : 'changes'}`;
    confirm.disabled = saving || !count;
    if (count) window.addEventListener('beforeunload', warnBeforeUnload);
    else window.removeEventListener('beforeunload', warnBeforeUnload);
  }

  function updateTile(button) {
    button.setAttribute('aria-pressed', String(status(button.dataset.kanji)));
  }

  function renderGrade() {
    grid.replaceChildren(...selectedGrade().characters.map(character => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'edit-kanji-tile';
      button.dataset.kanji = character;
      button.textContent = character;
      button.lang = 'ja';
      updateTile(button);
      return button;
    }));
  }

  open.addEventListener('click', () => {
    if (!canEdit()) return;
    original = getProgress().characters;
    changes.clear();
    grades.value = unlockedGrade(original);
    id('edit-progress-error').hidden = true;
    renderGrade();
    updateCount();
    dialog.showModal();
  });
  grades.addEventListener('change', renderGrade);
  grid.addEventListener('click', event => {
    const button = event.target.closest('button[data-kanji]');
    if (!button || saving) return;
    const character = button.dataset.kanji;
    setStatus(character, !status(character));
    updateTile(button);
    updateCount();
  });

  for (const [button, memorized] of [[markAll, true], [unmarkAll, false]]) {
    button.addEventListener('click', () => {
      for (const tile of grid.children) {
        setStatus(tile.dataset.kanji, memorized);
        updateTile(tile);
      }
      updateCount();
    });
  }

  function requestClose() {
    if (!saving && (!changes.size || window.confirm('Discard your unsaved progress changes?'))) dialog.close();
  }
  close.addEventListener('click', requestClose);
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    requestClose();
  });
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    changes.clear();
    original = {};
    updateCount();
  });

  confirm.addEventListener('click', async () => {
    saving = true;
    for (const control of [grades, markAll, unmarkAll, close, cancel]) control.disabled = true;
    updateCount();
    id('edit-progress-error').hidden = true;
    try {
      if (await saveChanges(new Map(changes))) dialog.close();
      else id('edit-progress-error').hidden = false;
    } catch {
      id('edit-progress-error').hidden = false;
    } finally {
      saving = false;
      for (const control of [grades, markAll, unmarkAll, close, cancel]) control.disabled = false;
      updateCount();
    }
  });
}
