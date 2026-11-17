import { normalizeName, slugify, splitCredit } from "./lib/names.mjs";

export const DEFAULT_RULE = { minSongs: 3, minPlays: 10, anyFavourite: true };
export const DEFAULT_WEIGHTS = { songs: 1, plays: 0.2, favourites: 3 };

function byFrequency(counts) {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value]) => value);
}

function increment(counts, value) {
  counts.set(value, (counts.get(value) || 0) + 1);
}

export function groupByArtist(tracks) {
  const knownNames = new Set(tracks.filter((track) => track.artist).map((track) => normalizeName(track.artist)));
  const groups = new Map();
  for (const track of tracks) {
    if (!track.artist) continue;
    for (const part of splitCredit(track.artist, knownNames)) {
      const key = normalizeName(part);
      if (!key) continue;
      if (!groups.has(key)) {
        groups.set(key, { key, spellings: new Map(), genres: new Map(), plays: 0, titles: new Map() });
      }
      const group = groups.get(key);
      increment(group.spellings, part);
      if (track.genre) increment(group.genres, track.genre);
      group.plays += track.plays;
      const titleKey = track.title.trim().toLowerCase();
      if (!group.titles.has(titleKey)) group.titles.set(titleKey, { spellings: new Map(), plays: 0, favourite: false });
      const entry = group.titles.get(titleKey);
      increment(entry.spellings, track.title.trim());
      entry.plays += track.plays;
      if (track.favourite) entry.favourite = true;
    }
  }
  return [...groups.values()].map((group) => ({
    key: group.key,
    name: byFrequency(group.spellings)[0],
    songs: group.titles.size,
    plays: group.plays,
    favourites: [...group.titles.values()].filter((entry) => entry.favourite).length,
    appleGenres: byFrequency(group.genres),
    tracks: [...group.titles.values()]
      .map((entry) => ({ title: byFrequency(entry.spellings)[0], plays: entry.plays }))
      .sort((left, right) => right.plays - left.plays || left.title.localeCompare(right.title)),
  }));
}

export function loveScore(group, weights = DEFAULT_WEIGHTS) {
  return group.songs * weights.songs + group.plays * weights.plays + group.favourites * weights.favourites;
}

export function passesRule(group, rule = DEFAULT_RULE) {
  return group.songs >= rule.minSongs || group.plays >= rule.minPlays || (rule.anyFavourite && group.favourites > 0);
}

export function selectArtists(groups, { rule = DEFAULT_RULE, weights = DEFAULT_WEIGHTS, forceIn = [], forceOut = [] } = {}) {
  const forcedIn = new Set(forceIn.map(normalizeName));
  const forcedOut = new Set(forceOut.map(normalizeName));
  const chosen = groups
    .filter((group) => !forcedOut.has(group.key) && (forcedIn.has(group.key) || passesRule(group, rule)))
    .sort((left, right) => left.key.localeCompare(right.key));
  const usedIds = new Set();
  return chosen.map((group) => {
    const base = slugify(group.name);
    let id = base;
    for (let suffix = 2; usedIds.has(id); suffix++) id = `${base}-${suffix}`;
    usedIds.add(id);
    return { ...group, id, love: Math.round(loveScore(group, weights) * 10) / 10 };
  });
}

export function missingForcedIn(groups, forceIn) {
  const keys = new Set(groups.map((group) => group.key));
  return forceIn.filter((name) => !keys.has(normalizeName(name)));
}
