import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from "d3-force";
import { normalizeName } from "./lib/names.mjs";

export const MISC_CLUSTER = "misc";
export const MIN_CLUSTER_SIZE = 3;
export const PALETTE = ["#c8361f", "#3f6b3a", "#2f5d8a", "#e0a526", "#7a3f8f", "#d36b9e", "#4a9a9a", "#a8661c", "#5b7f2a", "#8a3b52", "#3d6f8f", "#b5892f"];
export const MISC_COLOR = "#8a8a7a";
const NAME_BANNED_TAGS = new Set(["alternative"]);

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const edgeKey = (left, right) => (left < right ? `${left}|${right}` : `${right}|${left}`);
const tagSet = (artist) => new Set([...(artist.lfmTags || []).map((tag) => tag.name), ...(artist.mbGenres || [])]);

function jaccard(left, right) {
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const tag of left) if (right.has(tag)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export function buildEdges(artists) {
  const idByName = new Map(artists.map((artist) => [normalizeName(artist.name), artist.id]));
  const weights = new Map();
  const add = (left, right, weight) => {
    if (left === right) return;
    const key = edgeKey(left, right);
    weights.set(key, Math.max(weights.get(key) || 0, weight));
  };
  for (const artist of artists) {
    for (const similar of artist.lfmSimilar || []) {
      const otherId = idByName.get(normalizeName(similar.name));
      if (otherId) add(artist.id, otherId, similar.match);
    }
  }
  const connected = new Set([...weights.keys()].flatMap((key) => key.split("|")));
  const tags = new Map(artists.map((artist) => [artist.id, tagSet(artist)]));
  for (const artist of artists) {
    if (connected.has(artist.id)) continue;
    const others = artists.filter((other) => other.id !== artist.id);
    let fallback = others
      .map((other) => ({ id: other.id, weight: jaccard(tags.get(artist.id), tags.get(other.id)) * 0.5 }))
      .filter((candidate) => candidate.weight >= 0.1);
    const firstGenre = artist.appleGenres?.[0];
    if (fallback.length === 0 && firstGenre) {
      fallback = others.filter((other) => other.appleGenres?.[0] === firstGenre).map((other) => ({ id: other.id, weight: 0.1 }));
    }
    fallback
      .sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id))
      .slice(0, 3)
      .forEach((candidate) => add(artist.id, candidate.id, candidate.weight));
  }
  return [...weights.entries()]
    .map(([key, weight]) => {
      const [source, target] = key.split("|");
      return { source, target, weight: Math.round(weight * 1000) / 1000 };
    })
    .sort((left, right) => left.source.localeCompare(right.source) || left.target.localeCompare(right.target));
}

export function detectCommunities(ids, edges, { resolution = 1, seed = 42 } = {}) {
  const sortedIds = [...ids].sort();
  const graph = new Graph({ type: "undirected" });
  for (const id of sortedIds) graph.addNode(id);
  for (const edge of edges) {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) graph.mergeEdge(edge.source, edge.target, { weight: edge.weight });
  }
  const community = louvain(graph, { resolution, rng: mulberry32(seed), getEdgeWeight: "weight" });
  const members = new Map();
  for (const id of sortedIds) {
    if (!members.has(community[id])) members.set(community[id], []);
    members.get(community[id]).push(id);
  }
  const groups = [...members.values()].sort((left, right) => right.length - left.length || left[0].localeCompare(right[0]));
  const clusterOf = new Map();
  let index = 0;
  for (const group of groups) {
    const clusterId = group.length >= MIN_CLUSTER_SIZE ? `c${index++}` : MISC_CLUSTER;
    for (const id of group) clusterOf.set(id, clusterId);
  }
  return clusterOf;
}

const titleCase = (text) => text.replace(/\b\w/g, (letter) => letter.toUpperCase());

export function nameClusters(clusterOf, artists, nameOverrides = {}) {
  const byCluster = new Map();
  for (const artist of artists) {
    const clusterId = clusterOf.get(artist.id);
    if (!byCluster.has(clusterId)) byCluster.set(clusterId, []);
    byCluster.get(clusterId).push(artist);
  }
  const order = (id) => (id === MISC_CLUSTER ? Infinity : Number(id.slice(1)));
  const clusterIds = [...byCluster.keys()].sort((left, right) => order(left) - order(right));
  return clusterIds.map((id, index) => {
    const members = byCluster.get(id);
    const override = members.map((member) => nameOverrides[member.id]).find(Boolean);
    if (id === MISC_CLUSTER) return { id, name: override || "Everything else", color: MISC_COLOR, size: members.length };
    const scores = new Map();
    for (const member of members) {
      for (const tag of member.lfmTags || []) scores.set(tag.name, (scores.get(tag.name) || 0) + tag.count / 100);
      for (const genre of member.mbGenres || []) scores.set(genre, (scores.get(genre) || 0) + 0.5);
    }
    const topTags = [...scores.entries()]
      .filter(([tag]) => !NAME_BANNED_TAGS.has(tag))
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 2)
      .map(([tag]) => titleCase(tag));
    return { id, name: override || topTags.join(" / ") || "Unsorted", color: PALETTE[index % PALETTE.length], size: members.length };
  });
}

export function computePositions(ids, edges, previous = {}, { seed = 42, ticks = 400 } = {}) {
  const random = mulberry32(seed);
  const neighbours = new Map(ids.map((id) => [id, []]));
  for (const edge of edges) {
    neighbours.get(edge.source)?.push(edge.target);
    neighbours.get(edge.target)?.push(edge.source);
  }
  const nodes = [...ids].sort().map((id) => {
    const anchor = previous[id];
    // Existing artists are pinned so the map is stable across refreshes.
    // To re-layout from scratch, delete cache/positions.json.
    if (anchor) return { id, x: anchor.x, y: anchor.y, fx: anchor.x, fy: anchor.y };
    const placedNeighbour = neighbours.get(id).map((neighbourId) => previous[neighbourId]).find(Boolean);
    const angle = random() * Math.PI * 2;
    if (placedNeighbour) return { id, x: placedNeighbour.x + Math.cos(angle) * 20, y: placedNeighbour.y + Math.sin(angle) * 20 };
    const radius = 200 * Math.sqrt(random());
    return { id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  const known = new Set(ids);
  const links = edges.filter((edge) => known.has(edge.source) && known.has(edge.target)).map((edge) => ({ ...edge }));
  forceSimulation(nodes)
    .randomSource(random)
    .force("link", forceLink(links).id((node) => node.id).distance((link) => 30 + (1 - link.weight) * 90).strength((link) => 0.1 + link.weight * 0.6))
    .force("charge", forceManyBody().strength(-60))
    .force("collide", forceCollide(10))
    .force("centreX", forceX(0).strength(0.01))
    .force("centreY", forceY(0).strength(0.01))
    .stop()
    .tick(ticks);
  return Object.fromEntries(nodes.map((node) => [node.id, { x: Math.round(node.x * 10) / 10, y: Math.round(node.y * 10) / 10 }]));
}

export function runLayout(artists, previous, { clusterNames = {}, resolution = 1, seed = 42 } = {}) {
  const ids = artists.map((artist) => artist.id);
  const edges = buildEdges(artists);
  const clusterOf = detectCommunities(ids, edges, { resolution, seed });
  const clusters = nameClusters(clusterOf, artists, clusterNames);
  const positions = computePositions(ids, edges, previous, { seed });
  return { edges, clusterOf, clusters, positions };
}
