import { pickLabels } from "./camera.js";

const LABEL_HEIGHT_PX = 14;

// candidates: { id, name, x, y, emphasised, love } with (x, y) the top-centre of the label.
export function drawLabels(context, theme, candidates) {
  context.font = "12px 'Space Mono', monospace";
  context.textAlign = "center";
  context.textBaseline = "top";
  const measure = (item) => ({ width: context.measureText(item.name).width, height: LABEL_HEIGHT_PX });
  const drawn = new Set(pickLabels(candidates, measure));
  for (const item of candidates) {
    if (!drawn.has(item.id)) continue;
    context.lineWidth = 3;
    context.strokeStyle = theme.bg;
    context.strokeText(item.name, item.x, item.y);
    context.fillStyle = theme.ink;
    context.fillText(item.name, item.x, item.y);
  }
}
