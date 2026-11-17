import { createCamera, worldToScreen, screenToWorld, zoomAt, panBy, fitBounds, nodeRadius, hitTest, labelVisible } from "./camera.js";
import { lerpCamera } from "./juice.js";

const CLICK_SLOP_PX = 5;
const GLIDE_MS = 650;

function readTheme() {
  const style = getComputedStyle(document.documentElement);
  const token = (name) => style.getPropertyValue(name).trim();
  return { bg: token("--bg"), ink: token("--ink"), muted: token("--muted"), accent: token("--stamp") };
}

export function createMap({ canvas, data, juice, onSelect }) {
  const context = canvas.getContext("2d");
  const clusterColor = new Map(data.clusters.map((cluster) => [cluster.id, cluster.color]));
  const nodes = data.artists.map((artist) => ({ ...artist, r: nodeRadius(artist.love) }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let camera = createCamera(1, 1);
  let theme = readTheme();
  let tween = null;
  let hoveredId = null;
  let selectedId = null;
  let story = null;
  let frameRequested = false;
  let lastFrame = 0;

  const neighboursOf = (node) => node.similar.map((link) => ({ node: byId.get(link.id), weight: link.weight })).filter((link) => link.node);
  const position = (node) => { const [dx, dy] = juice.offset(node.id); return [node.x + dx, node.y + dy]; };
  const screenOf = (node) => worldToScreen(camera, ...position(node));

  function requestFrame() {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(frame);
  }

  function frame(now) {
    frameRequested = false;
    const dt = Math.min(1 / 30, lastFrame ? (now - lastFrame) / 1000 : 1 / 60);
    lastFrame = now;
    let animating = juice.step(dt, now);
    if (tween) {
      const progress = Math.min(1, (now - tween.start) / GLIDE_MS);
      camera = { ...lerpCamera(tween.from, tween.to, progress), width: camera.width, height: camera.height };
      if (progress < 1) animating = true;
      else tween = null;
    }
    draw(now);
    if (animating) requestFrame();
    else lastFrame = 0;
  }

  function drawLines(focusId) {
    const focus = byId.get(focusId);
    if (!focus) return;
    const [fx, fy] = screenOf(focus);
    context.strokeStyle = theme.muted;
    for (const { node, weight } of neighboursOf(focus)) {
      const [nx, ny] = screenOf(node);
      context.globalAlpha = 0.25 + weight * 0.6;
      context.lineWidth = 1 + weight * 2;
      context.beginPath();
      context.moveTo(fx, fy);
      context.lineTo(nx, ny);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  function drawStoryPath() {
    const points = story.ids.slice(0, story.current + 1).map((id) => byId.get(id)).filter(Boolean).map(screenOf);
    if (points.length < 2) return;
    context.strokeStyle = theme.accent;
    context.lineWidth = 3;
    context.setLineDash([8, 6]);
    context.beginPath();
    points.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
    context.stroke();
    context.setLineDash([]);
  }

  function draw(now) {
    const { width, height } = camera;
    const focusId = hoveredId || selectedId;
    const storyIds = story ? new Set(story.ids) : null;
    context.fillStyle = theme.bg;
    context.fillRect(0, 0, width, height);
    if (focusId) drawLines(focusId);
    if (story) drawStoryPath();
    for (const node of nodes) {
      const [x, y] = screenOf(node);
      const radius = Math.max(1.5, node.r * camera.scale * juice.scale(node.id));
      if (x < -radius || y < -radius || x > width + radius || y > height + radius) continue;
      context.globalAlpha = storyIds && !storyIds.has(node.id) ? 0.15 : 1;
      context.fillStyle = clusterColor.get(node.cluster) || theme.muted;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
      if (node.id === selectedId) {
        context.strokeStyle = theme.ink;
        context.lineWidth = 2;
        context.stroke();
      }
    }
    context.globalAlpha = 1;
    for (const pulse of juice.activePulses(now)) {
      const [x, y] = worldToScreen(camera, pulse.x, pulse.y);
      context.globalAlpha = 1 - pulse.progress;
      context.strokeStyle = theme.accent;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(x, y, 10 + pulse.progress * 50, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
    context.font = "12px 'Space Mono', monospace";
    context.textAlign = "center";
    context.textBaseline = "top";
    for (const node of nodes) {
      const inStory = storyIds?.has(node.id);
      if (storyIds && !inStory) continue;
      if (!labelVisible(node.r, camera.scale, node.id === focusId || inStory)) continue;
      const [x, y] = screenOf(node);
      const labelY = y + node.r * camera.scale * juice.scale(node.id) + 3;
      context.lineWidth = 3;
      context.strokeStyle = theme.bg;
      context.strokeText(node.name, x, labelY);
      context.fillStyle = theme.ink;
      context.fillText(node.name, x, labelY);
    }
  }

  function flyTo(id) {
    const node = byId.get(id);
    if (!node) return;
    const target = { ...camera, x: node.x, y: node.y, scale: Math.max(camera.scale, 1.6) };
    if (juice.reducedMotion) camera = target;
    else tween = { from: { ...camera }, to: target, start: performance.now() };
    requestFrame();
  }

  function select(id) {
    selectedId = byId.has(id) ? id : null;
    const node = byId.get(selectedId);
    if (node) {
      juice.poke(node, neighboursOf(node));
      juice.pulse(node.x, node.y, performance.now());
    }
    requestFrame();
  }

  function setStory(next) {
    story = next;
    requestFrame();
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    camera = { ...camera, width, height };
    requestFrame();
  }

  const pointers = new Map();
  let drag = null;
  let pinchDistance = null;
  const local = (event) => { const rect = canvas.getBoundingClientRect(); return [event.clientX - rect.left, event.clientY - rect.top]; };
  const nodeAt = (event) => hitTest(nodes, ...screenToWorld(camera, ...local(event)), 4 / camera.scale);

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    drag = { x: event.clientX, y: event.clientY, moved: false };
    tween = null;
  });
  canvas.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) {
      const hit = nodeAt(event);
      if ((hit?.id ?? null) === hoveredId) return;
      hoveredId = hit?.id ?? null;
      juice.hover(hoveredId);
      if (hit) juice.poke(hit, neighboursOf(hit));
      canvas.style.cursor = hit ? "pointer" : "grab";
      requestFrame();
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [first, second] = [...pointers.values()];
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      const rect = canvas.getBoundingClientRect();
      if (pinchDistance) camera = zoomAt(camera, (first.x + second.x) / 2 - rect.left, (first.y + second.y) / 2 - rect.top, distance / pinchDistance);
      pinchDistance = distance;
      drag.moved = true;
    } else {
      camera = panBy(camera, event.clientX - previous.x, event.clientY - previous.y);
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > CLICK_SLOP_PX) drag.moved = true;
    }
    requestFrame();
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchDistance = null;
    if (pointers.size === 0 && drag && !drag.moved && event.type === "pointerup") onSelect(nodeAt(event)?.id ?? null);
    if (pointers.size === 0) drag = null;
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", () => {
    if (!hoveredId || pointers.size) return;
    hoveredId = null;
    juice.hover(null);
    requestFrame();
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    camera = zoomAt(camera, ...local(event), Math.exp(-event.deltaY * 0.0015));
    tween = null;
    requestFrame();
  }, { passive: false });
  canvas.addEventListener("keydown", (event) => {
    const pans = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
    const zooms = { "+": 1.25, "=": 1.25, "-": 0.8 };
    if (pans[event.key]) camera = panBy(camera, ...pans[event.key]);
    else if (zooms[event.key]) camera = zoomAt(camera, camera.width / 2, camera.height / 2, zooms[event.key]);
    else return;
    event.preventDefault();
    requestFrame();
  });
  window.addEventListener("resize", resize);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { theme = readTheme(); requestFrame(); });

  resize();
  camera = fitBounds(camera, nodes);
  requestFrame();
  return { flyTo, select, setStory, byId };
}
