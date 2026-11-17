import { normalizeName } from "./lib/names.mjs";

export const MB_BASE = "https://musicbrainz.org/ws/2";
export const MB_USER_AGENT = "music-web/0.1 ( https://joelmgallant.com/music/ )";
export const MB_MIN_INTERVAL_MS = 1100;

const RELATION_LABELS = {
  "member of band": { forward: "member of", backward: "member" },
  subgroup: { forward: "related group", backward: "related group" },
  "is person": { forward: "same person", backward: "same person" },
};

export function searchUrl(name) {
  const query = `artist:"${name.replace(/"/g, "")}"`;
  return `${MB_BASE}/artist?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
}

export function lookupUrl(mbid) {
  return `${MB_BASE}/artist/${mbid}?inc=artist-rels+genres&fmt=json`;
}

export function pickMatch(searchJson, name, minScore = 95) {
  const wanted = normalizeName(name);
  const candidates = (searchJson.artists || [])
    .filter((candidate) => candidate.score >= minScore && normalizeName(candidate.name) === wanted)
    .sort((left, right) => right.score - left.score);
  if (candidates.length === 0) return { mbid: null, reason: "no confident match" };
  if (candidates.length > 1) return { mbid: null, reason: `ambiguous: ${candidates.length} artists named "${name}"` };
  return { mbid: candidates[0].id, reason: null };
}

export function parseLineage(artistJson) {
  const seen = new Set();
  const lineage = [];
  for (const relation of artistJson.relations || []) {
    const labels = RELATION_LABELS[relation.type];
    if (!labels || !relation.artist) continue;
    const label = labels[relation.direction] || labels.forward;
    const key = `${label}|${relation.artist.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lineage.push({ relation: label, name: relation.artist.name, mbid: relation.artist.id });
  }
  return lineage.sort((left, right) => left.relation.localeCompare(right.relation) || left.name.localeCompare(right.name));
}

export function parseGenres(artistJson) {
  return (artistJson.genres || [])
    .slice()
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    .slice(0, 5)
    .map((genre) => genre.name);
}

export async function enrichMusicBrainz(artists, { fetcher, pinned = {} }) {
  const enriched = [];
  const unmatched = [];
  for (const artist of artists) {
    let mbid = pinned[artist.id] || null;
    let reason = null;
    if (!mbid) ({ mbid, reason } = pickMatch(await fetcher.getJson(searchUrl(artist.name)), artist.name));
    if (!mbid) {
      unmatched.push({ id: artist.id, name: artist.name, reason });
      enriched.push({ ...artist, mbid: null, mbGenres: [], lineage: [] });
      continue;
    }
    const details = await fetcher.getJson(lookupUrl(mbid));
    enriched.push({ ...artist, mbid, mbGenres: parseGenres(details), lineage: parseLineage(details) });
  }
  return { artists: enriched, unmatched };
}
