export const MIN_SCALE = 0.2;
export const MAX_SCALE = 6;

export function createCamera(width, height) {
  return { x: 0, y: 0, scale: 1, width, height };
}

export function worldToScreen(camera, worldX, worldY) {
  return [(worldX - camera.x) * camera.scale + camera.width / 2, (worldY - camera.y) * camera.scale + camera.height / 2];
}

export function screenToWorld(camera, screenX, screenY) {
  return [(screenX - camera.width / 2) / camera.scale + camera.x, (screenY - camera.height / 2) / camera.scale + camera.y];
}

export function clampScale(scale) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function zoomAt(camera, screenX, screenY, factor) {
  const [worldX, worldY] = screenToWorld(camera, screenX, screenY);
  const zoomed = { ...camera, scale: clampScale(camera.scale * factor) };
  const [afterX, afterY] = screenToWorld(zoomed, screenX, screenY);
  return { ...zoomed, x: camera.x + (worldX - afterX), y: camera.y + (worldY - afterY) };
}

export function panBy(camera, deltaX, deltaY) {
  return { ...camera, x: camera.x - deltaX / camera.scale, y: camera.y - deltaY / camera.scale };
}

export function trimmedBounds(points, trim = 0.03) {
  const sortedRange = (values) => {
    const sorted = [...values].sort((left, right) => left - right);
    const drop = Math.min(Math.floor(sorted.length * trim), Math.floor((sorted.length - 1) / 2));
    return [sorted[drop], sorted[sorted.length - 1 - drop]];
  };
  const [minX, maxX] = sortedRange(points.map((point) => point.x));
  const [minY, maxY] = sortedRange(points.map((point) => point.y));
  return { minX, maxX, minY, maxY };
}

export function fitBounds(camera, points, { padding = 40, trim = 0 } = {}) {
  if (points.length === 0) return camera;
  const { minX, maxX, minY, maxY } = trimmedBounds(points, trim);
  const scale = clampScale(Math.min((camera.width - padding * 2) / (maxX - minX || 1), (camera.height - padding * 2) / (maxY - minY || 1)));
  return { ...camera, x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale };
}

export function centreOn(camera, worldX, worldY, scale, [offsetX, offsetY] = [0, 0]) {
  return { ...camera, x: worldX - offsetX / scale, y: worldY - offsetY / scale, scale };
}

export function nodeRadius(love) {
  return 2 + 1.6 * Math.sqrt(Math.max(0, love));
}

export function hitTest(nodes, worldX, worldY, slop) {
  let best = null;
  let bestDistance = Infinity;
  for (const node of nodes) {
    const distance = Math.hypot(node.x - worldX, node.y - worldY);
    if (distance <= node.r + slop && distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

export function labelVisible(radius, scale, emphasised) {
  return emphasised || radius * scale >= 9;
}

function overlaps(first, second) {
  return first.left < second.right && second.left < first.right && first.top < second.bottom && second.top < first.bottom;
}

// Items carry the top-centre of their label; measure(item) gives { width, height } when the item has none.
export function pickLabels(candidates, measure = (item) => item) {
  const ordered = [...candidates].sort((left, right) => Number(right.emphasised) - Number(left.emphasised) || right.love - left.love);
  const placed = [];
  const kept = [];
  for (const item of ordered) {
    const { width, height } = measure(item);
    const box = { left: item.x - width / 2, right: item.x + width / 2, top: item.y, bottom: item.y + height };
    if (!item.emphasised && placed.some((other) => overlaps(box, other))) continue;
    placed.push(box);
    kept.push(item.id);
  }
  return kept;
}
