// Pure genre-highlight helpers. No DOM, so node:test can import them.
export function toggleCluster(set, clusterId) {
  const next = new Set(set);
  if (next.has(clusterId)) next.delete(clusterId);
  else next.add(clusterId);
  return next;
}

const isActive = (highlight) => Boolean(highlight && highlight.size > 0);

export function isDimmed(node, { storyIds, highlight }) {
  if (storyIds && !storyIds.has(node.id)) return true;
  return isActive(highlight) && !highlight.has(node.cluster);
}

export function highlightedNodes(nodes, highlight) {
  return isActive(highlight) ? nodes.filter((node) => highlight.has(node.cluster)) : [];
}
