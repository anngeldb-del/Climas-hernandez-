/**
 * signature-pad.js
 * -----------------------------------------------------------------------
 * Minimal canvas-based signature capture (mouse + touch/pen). Used on
 * service orders to collect the client's and the technician's sign-off.
 */

export function createSignaturePad(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'signature-pad';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasStrokes = false;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
  }
  resize();
  window.addEventListener('resize', resize);

  function pointerPos(event) {
    const rect = canvas.getBoundingClientRect();
    const point = event.touches ? event.touches[0] : event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(event) {
    event.preventDefault();
    drawing = true;
    hasStrokes = true;
    const { x, y } = pointerPos(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(event) {
    if (!drawing) return;
    event.preventDefault();
    const { x, y } = pointerPos(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() { drawing = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  return {
    canvas,
    isEmpty: () => !hasStrokes,
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasStrokes = false;
    },
    destroy() {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mouseup', end);
    }
  };
}
