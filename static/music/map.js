import { createCamera, worldToScreen, screenToWorld, fitBounds, nodeRadius, hitTest, labelVisible, centreOn } from "./camera.js";
import { lerpCamera } from "./juice.js";
import { attachInput } from "./map-input.js";
import { drawLabels } from "./map-labels.js";

const GLIDE_MS = 650;
const TOP_LABELLED = 15;

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
  const topLoved = new Set([...nodes].sort((left, right) => right.love - left.love).slice(0, TOP_LABELLED).map((node) => node.id));
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
    drawNodeLabels(focusId, storyIds);
  }

  function drawNodeLabels(focusId, storyIds) {
    const candidates = [];
    for (const node of nodes) {
      const inStory = storyIds?.has(node.id);
      if (storyIds && !inStory) continue;
      const emphasised = node.id === focusId || Boolean(inStory);
      if (!emphasised && !topLoved.has(node.id) && !labelVisible(node.r, camera.scale, false)) continue;
      const [x, y] = screenOf(node);
      candidates.push({ id: node.id, name: node.name, x, y: y + node.r * camera.scale * juice.scale(node.id) + 3, emphasised, love: node.love });
    }
    drawLabels(context, theme, candidates);
  }

  function flyTo(id, { screenOffset = [0, 0] } = {}) {
    const node = byId.get(id);
    if (!node) return;
    const target = centreOn(camera, node.x, node.y, Math.max(camera.scale, 1.6), screenOffset);
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

  function onHover(hit) {
    if ((hit?.id ?? null) === hoveredId) return;
    hoveredId = hit?.id ?? null;
    juice.hover(hoveredId);
    if (hit) juice.poke(hit, neighboursOf(hit));
    requestFrame();
  }

  attachInput(canvas, {
    getCamera: () => camera,
    setCamera: (next) => { camera = next; },
    nodeAt: (x, y) => hitTest(nodes, ...screenToWorld(camera, x, y), 4 / camera.scale),
    onHover,
    onSelect,
    cancelTween: () => { tween = null; },
    requestFrame,
  });
  window.addEventListener("resize", resize);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { theme = readTheme(); requestFrame(); });

  resize();
  camera = fitBounds(camera, nodes, { trim: 0.03 });
  document.fonts?.ready.then(requestFrame);
  requestFrame();
  return { flyTo, select, setStory, byId };
}
