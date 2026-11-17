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

export function fitBounds(camera, points, padding = 40) {
  if (points.length === 0) return camera;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = clampScale(Math.min((camera.width - padding * 2) / (maxX - minX || 1), (camera.height - padding * 2) / (maxY - minY || 1)));
  return { ...camera, x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale };
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
