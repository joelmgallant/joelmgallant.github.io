// Overlay lines: similarity links around the focused artist and the story path.
export function drawLinks(context, theme, { focus, neighbours, screenOf }) {
  const [fx, fy] = screenOf(focus);
  context.strokeStyle = theme.muted;
  for (const { node, weight } of neighbours) {
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

export function drawStoryPath(context, theme, points) {
  if (points.length < 2) return;
  context.strokeStyle = theme.accent;
  context.lineWidth = 3;
  context.setLineDash([8, 6]);
  context.beginPath();
  points.forEach(([x, y], index) => (index === 0 ? context.moveTo(x, y) : context.lineTo(x, y)));
  context.stroke();
  context.setLineDash([]);
}
