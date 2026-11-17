import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export function assembleData({ artists, edges, clusterOf, clusters, positions, stories, stats, generated }) {
  const idByMbid = new Map(artists.filter((artist) => artist.mbid).map((artist) => [artist.mbid, artist.id]));
  const similarById = new Map(artists.map((artist) => [artist.id, []]));
  for (const edge of edges) {
    similarById.get(edge.source)?.push({ id: edge.target, weight: edge.weight });
    similarById.get(edge.target)?.push({ id: edge.source, weight: edge.weight });
  }
  return {
    generated,
    stats,
    clusters: clusters.map(({ id, name, color }) => ({ id, name, color })),
    artists: artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      mbid: artist.mbid,
      cluster: clusterOf.get(artist.id),
      x: positions[artist.id].x,
      y: positions[artist.id].y,
      love: artist.love,
      songs: artist.songs,
      plays: artist.plays,
      favourites: artist.favourites,
      appleGenres: artist.appleGenres,
      tracks: artist.tracks,
      similar: similarById.get(artist.id).sort((left, right) => right.weight - left.weight || left.id.localeCompare(right.id)).slice(0, 8),
      lineage: artist.lineage.map((item) => ({ ...item, id: idByMbid.get(item.mbid) || null })),
    })),
    stories,
  };
}

export function validateData(data, { forbiddenStrings = [] } = {}) {
  const errors = [];
  const ids = new Set();
  const clusterIds = new Set(data.clusters.map((cluster) => cluster.id));
  for (const artist of data.artists) {
    if (ids.has(artist.id)) errors.push(`duplicate artist id: ${artist.id}`);
    ids.add(artist.id);
    if (!clusterIds.has(artist.cluster)) errors.push(`${artist.id}: unknown cluster ${artist.cluster}`);
    if (!Number.isFinite(artist.x) || !Number.isFinite(artist.y)) errors.push(`${artist.id}: position is not a finite number`);
  }
  for (const artist of data.artists) {
    for (const similar of artist.similar) if (!ids.has(similar.id)) errors.push(`${artist.id}: similar artist ${similar.id} does not exist`);
    for (const item of artist.lineage) if (item.id && !ids.has(item.id)) errors.push(`${artist.id}: lineage id ${item.id} does not exist`);
  }
  for (const story of data.stories) {
    for (const step of story.steps) if (!ids.has(step.artist)) errors.push(`story ${story.id}: artist ${step.artist} is not on the map`);
  }
  const text = JSON.stringify(data);
  for (const secret of forbiddenStrings) {
    if (secret && text.includes(secret)) errors.push("output contains a forbidden string (an API key?)");
  }
  return errors;
}

export function largestMoves(previous, positions, limit = 5) {
  return Object.keys(positions)
    .filter((id) => previous[id])
    .map((id) => ({ id, distance: Math.round(Math.hypot(positions[id].x - previous[id].x, positions[id].y - previous[id].y) * 10) / 10 }))
    .filter((move) => move.distance > 0)
    .sort((left, right) => right.distance - left.distance || left.id.localeCompare(right.id))
    .slice(0, limit);
}

export async function loadStories(dir) {
  let files;
  try {
    files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return Promise.all(files.map(async (file) => JSON.parse(await readFile(join(dir, file), "utf8"))));
}

const listed = (items, format) => items.map((item) => `  - ${format(item)}`);

export function formatReport({ trackCount, groupCount, selected, newIds, unmatched, lastfmMissing, missingForced, clusters, moves, network, errors, outFile }) {
  const newList = newIds.length ? ` (${newIds.slice(0, 10).join(", ")}${newIds.length > 10 ? ", …" : ""})` : "";
  const lines = [
    `Tracks read: ${trackCount}`,
    `Artists in library: ${groupCount}`,
    `Artists on the map: ${selected}`,
    `New since last run: ${newIds.length}${newList}`,
    `MusicBrainz unmatched: ${unmatched.length}`,
    ...listed(unmatched, (item) => `${item.name} [${item.id}]: ${item.reason}`),
    `Last.fm had nothing for: ${lastfmMissing.length}`,
    ...listed(lastfmMissing, (item) => `${item.name} [${item.id}]`),
    `Clusters: ${clusters.length}`,
    ...listed(clusters, (cluster) => `${cluster.id} "${cluster.name}" (${cluster.size})`),
    `Largest moves: ${moves.length ? moves.map((move) => `${move.id} ${move.distance}`).join(", ") : "none (first run, or nothing moved)"}`,
    `HTTP: ${network.network} network requests, ${network.cached} from cache`,
  ];
  if (missingForced.length) lines.push(`forceIn names not found in the library: ${missingForced.join(", ")}`);
  if (errors.length) lines.push(`VALIDATION FAILED (${errors.length}):`, ...listed(errors, (error) => error));
  else lines.push("Validation: ok", `Wrote ${outFile}`);
  return lines.join("\n");
}
