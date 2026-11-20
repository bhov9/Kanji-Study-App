export function setupHandwriting() {
  const id = name => document.getElementById(name);
  const toggle = id('write');
  const panel = id('handwriting');
  const grid = id('writing-boxes');
  const undo = id('undo-stroke');
  const clear = id('clear-writing');
  const clearAll = id('clear-all-writing');
  const check = id('check-writing');
  let pads = [];
  let selected;
  let active;
  let writingMode = false;
  let revealed = false;
  const observer = new ResizeObserver(entries => {
    for (const { target } of entries) {
      const pad = pads.find(item => item.canvas === target);
      if (pad) paint(pad);
    }
  });

  function paint({ canvas, strokes }) {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const scale = window.devicePixelRatio || 1;
    const pixelsWide = Math.max(1, Math.round(width * scale));
    const pixelsHigh = Math.max(1, Math.round(height * scale));
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(pixelsWide / width, 0, 0, pixelsHigh / height, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = ctx.fillStyle = '#24231f';
    ctx.lineWidth = Math.max(2, width * .02);
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      const first = stroke[0];
      ctx.beginPath();
      if (stroke.length > 1) {
        ctx.moveTo(first.x * width, first.y * height);
        for (let index = 1; index < stroke.length; index++) {
          const point = stroke[index];
          ctx.lineTo(point.x * width, point.y * height);
        }
        ctx.stroke();
      } else {
        ctx.arc(first.x * width, first.y * height, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function redraw(pad) {
    if (pad.frame) return;
    pad.frame = requestAnimationFrame(() => {
      pad.frame = 0;
      paint(pad);
    });
  }

  function point(event, rect) {
    const clamp = value => Math.max(0, Math.min(1, value));
    return { x: clamp((event.clientX - rect.left) / rect.width), y: clamp((event.clientY - rect.top) / rect.height) };
  }

  function updateControls() {
    undo.disabled = clear.disabled = !selected?.strokes.length;
    clearAll.disabled = !pads.some(pad => pad.strokes.length);
    id('writing-selection').textContent = selected ? `Writing box ${selected.index + 1} selected` : '';
  }

  function select(pad) {
    selected?.box.removeAttribute('data-selected');
    selected = pad;
    pad.box.dataset.selected = '';
    updateControls();
  }

  function stopStroke() {
    if (!active) return;
    const { pad, pointer } = active;
    active = undefined;
    if (pad.canvas.hasPointerCapture(pointer)) pad.canvas.releasePointerCapture(pointer);
  }

  function makePad(character, index) {
    const box = document.createElement('div');
    box.className = 'writing-pad';
    const label = document.createElement('span');
    label.textContent = `Box ${index + 1}`;
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', `Writing box ${index + 1}`);
    box.append(label, canvas);
    const pad = { character, index, canvas, box, strokes: [], frame: 0 };
    canvas.addEventListener('focus', () => select(pad));
    canvas.addEventListener('pointerdown', event => {
      if (active || event.button !== 0) return;
      select(pad);
      const stroke = [point(event, canvas.getBoundingClientRect())];
      pad.strokes.push(stroke);
      active = { pad, pointer: event.pointerId, stroke };
      canvas.setPointerCapture(event.pointerId);
      updateControls();
      redraw(pad);
    });
    canvas.addEventListener('pointermove', event => {
      if (active?.pointer !== event.pointerId || active.pad !== pad) return;
      const rect = canvas.getBoundingClientRect();
      const samples = event.getCoalescedEvents?.();
      for (const sample of samples?.length ? samples : [event]) active.stroke.push(point(sample, rect));
      redraw(pad);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, event => {
        if (active?.pointer === event.pointerId && active.pad === pad) stopStroke();
      });
    }
    observer.observe(canvas);
    return pad;
  }

  function updateVisibility() {
    const open = pads.length > 0 && (writingMode || (revealed && pads.some(pad => pad.strokes.length)));
    panel.hidden = !open;
    grid.hidden = revealed;
    check.hidden = revealed;
    toggle.hidden = revealed || !pads.length;
    toggle.setAttribute('aria-expanded', String(open && !revealed));
  }

  toggle.addEventListener('click', () => {
    writingMode = !writingMode;
    updateVisibility();
  });
  undo.addEventListener('click', () => {
    stopStroke();
    selected.strokes.pop();
    redraw(selected);
    updateControls();
  });
  clear.addEventListener('click', () => {
    stopStroke();
    selected.strokes.length = 0;
    redraw(selected);
    updateControls();
  });
  clearAll.addEventListener('click', () => {
    stopStroke();
    for (const pad of pads) {
      pad.strokes.length = 0;
      redraw(pad);
    }
    updateControls();
  });

  return {
    reset(targets) {
      stopStroke();
      observer.disconnect();
      for (const pad of pads) cancelAnimationFrame(pad.frame);
      selected = undefined;
      revealed = false;
      pads = targets.map(makePad);
      grid.replaceChildren(...pads.map(pad => pad.box));
      if (pads.length) select(pads[0]);
      updateVisibility();
    },
    hasDraft: () => pads.some(pad => pad.strokes.length > 0),
    reveal() {
      stopStroke();
      revealed = true;
      updateVisibility();
      return new Map(panel.hidden ? [] : pads.map(pad => [pad.character, pad.box]));
    },
  };
}
