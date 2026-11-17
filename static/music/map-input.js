import { zoomAt, panBy } from "./camera.js";

const CLICK_SLOP_PX = 5;
const LINE_HEIGHT_PX = 16;

// Normalises wheel deltas to pixels: deltaMode 1 is lines, 2 is pages.
export function wheelPixels(event, pageHeight = window.innerHeight) {
  if (event.deltaMode === 1) return event.deltaY * LINE_HEIGHT_PX;
  if (event.deltaMode === 2) return event.deltaY * pageHeight;
  return event.deltaY;
}

// handlers: { getCamera, setCamera, nodeAt(x, y) -> node|null, onHover(node|null), onSelect(id|null), cancelTween, requestFrame }
export function attachInput(canvas, handlers) {
  const { getCamera, setCamera, nodeAt, onHover, onSelect, cancelTween, requestFrame } = handlers;
  const pointers = new Map();
  let drag = null;
  let pinchDistance = null;
  const local = (event) => { const rect = canvas.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top]; };

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    drag = { x: event.clientX, y: event.clientY, moved: false };
    cancelTween();
  });
  canvas.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) {
      const hit = nodeAt(...local(event));
      canvas.style.cursor = hit ? "pointer" : "grab";
      onHover(hit);
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const rect = canvas.getBoundingClientRect();
      if (pinchDistance) setCamera(zoomAt(getCamera(), (first.x + second.x) / 2 - rect.left, (first.y + second.y) / 2 - rect.top, distance / pinchDistance));
      pinchDistance = distance;
      drag.moved = true;
    } else {
      setCamera(panBy(getCamera(), event.clientX - previous.x, event.clientY - previous.y));
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > CLICK_SLOP_PX) drag.moved = true;
    }
    requestFrame();
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = null;
    if (pointers.size === 0 && drag && !drag.moved && event.type === "pointerup") onSelect(nodeAt(...local(event))?.id ?? null);
    if (pointers.size === 0) drag = null;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", () => { if (!pointers.size) onHover(null); });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    setCamera(zoomAt(getCamera(), ...local(event), Math.exp(-wheelPixels(event) * 0.0015)));
    cancelTween();
    requestFrame();
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    const pans = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
    const zooms = { "+": 1.25, "=": 1.25, "-": 0.8 };
    const camera = getCamera();
    if (pans[event.key]) setCamera(panBy(camera, ...pans[event.key]));
    else if (zooms[event.key]) setCamera(zoomAt(camera, camera.width / 2, camera.height / 2, zooms[event.key]));
    else return;
    event.preventDefault();
    requestFrame();
  });
}
