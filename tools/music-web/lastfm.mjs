import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";
export const LASTFM_MIN_INTERVAL_MS = 250;
export const LASTFM_USER_AGENT = "music-web/0.1 ( https://joelmgallant.com/music/ )";

const GENERIC_TAGS = new Set([
  "seen live", "favorites", "favourites", "favorite", "favourite", "male vocalists", "female vocalists",
  "american", "british", "canadian", "usa", "uk", "english", "australian", "irish", "scottish", "all",
]);

export function readApiKey(path = join(homedir(), ".secrets/tokens/lastfm-api-key")) {
  const key = readFileSync(path, "utf8").trim();
  if (!/^[0-9a-f]{32}$/.test(key)) throw new Error(`Last.fm key at ${path} is not a 32-character hex string`);
  return key;
}

export function methodUrl(method, artistName, apiKey) {
  const params = new URLSearchParams({ method, artist: artistName, autocorrect: "1", limit: "100", format: "json" });
  const cacheKey = `${LASTFM_BASE}?${params}`;
  params.set("api_key", apiKey);
  return { url: `${LASTFM_BASE}?${params}`, cacheKey };
}

export function parseSimilar(json) {
  if (json.error || !json.similarartists) return [];
  return json.similarartists.artist
    .map((artist) => ({ name: artist.name, match: Number(artist.match) }))
    .filter((artist) => artist.match > 0);
}

export function parseTopTags(json) {
  if (json.error || !json.toptags) return [];
  return json.toptags.tag
    .map((tag) => ({ name: tag.name.toLowerCase().trim(), count: Number(tag.count) }))
    .filter((tag) => tag.count >= 10 && !GENERIC_TAGS.has(tag.name))
    .slice(0, 10);
}

export async function enrichLastfm(artists, { fetcher, apiKey }) {
  const enriched = [];
  const missing = [];
  for (const artist of artists) {
    const similarRequest = methodUrl("artist.getSimilar", artist.name, apiKey);
    const tagsRequest = methodUrl("artist.getTopTags", artist.name, apiKey);
    const lfmSimilar = parseSimilar(await fetcher.getJson(similarRequest.url, { cacheKey: similarRequest.cacheKey }));
    const lfmTags = parseTopTags(await fetcher.getJson(tagsRequest.url, { cacheKey: tagsRequest.cacheKey }));
    if (lfmSimilar.length === 0 && lfmTags.length === 0) missing.push({ id: artist.id, name: artist.name });
    enriched.push({ ...artist, lfmSimilar, lfmTags });
  }
  return { artists: enriched, missing };
}
