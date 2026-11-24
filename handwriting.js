export function setupHandwriting() {
  const id = name => document.getElementById(name);
  const toggle = id('write');
  const panel = id('handwriting');
  const grid = id('writing-boxes');
  const check = id('check-writing');
  let pads = [];
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

  function stopStroke() {
    if (!active) return;
    const { pad, pointer } = active;
    active = undefined;
    if (pad.canvas.hasPointerCapture(pointer)) pad.canvas.releasePointerCapture(pointer);
  }

  function makePad(character, index) {
    const box = document.createElement('div');
    box.className = 'writing-pad';
    box.addEventListener('contextmenu', event => event.preventDefault());
    const label = document.createElement('span');
    label.textContent = `Box ${index + 1}`;
    const canvas = document.createElement('canvas');
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', `Writing box ${index + 1}`);
    const tools = document.createElement('div');
    tools.className = 'writing-tools';
    tools.setAttribute('role', 'group');
    tools.setAttribute('aria-label', `Controls for writing box ${index + 1}`);
    box.append(label, canvas, tools);
    const pad = { character, canvas, box, tools, strokes: [], frame: 0 };
    function addControl(text, change) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.disabled = true;
      button.addEventListener('click', () => {
        if (active?.pad === pad) stopStroke();
        change();
        redraw(pad);
        updateControls();
      });
      tools.append(button);
    }
    function updateControls() {
      for (const button of tools.children) button.disabled = !pad.strokes.length;
    }
    addControl('Undo Last Stroke', () => pad.strokes.pop());
    addControl('Clear', () => { pad.strokes.length = 0; });
    canvas.addEventListener('pointerdown', event => {
      if (active || event.button !== 0) return;
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
  return {
    reset(targets) {
      stopStroke();
      observer.disconnect();
      for (const pad of pads) cancelAnimationFrame(pad.frame);
      revealed = false;
      pads = targets.map(makePad);
      grid.replaceChildren(...pads.map(pad => pad.box));
      updateVisibility();
    },
    hasDraft: () => pads.some(pad => pad.strokes.length > 0),
    reveal() {
      stopStroke();
      revealed = true;
      for (const pad of pads) pad.tools.hidden = true;
      updateVisibility();
      return new Map(panel.hidden ? [] : pads.map(pad => [pad.character, pad.box]));
    },
  };
}
