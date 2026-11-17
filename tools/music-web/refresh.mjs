import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { exportLibrary } from "./export-library.mjs";
import { groupByArtist, selectArtists, missingForcedIn } from "./select.mjs";
import { createFetcher } from "./lib/cached-fetch.mjs";
import { enrichMusicBrainz, MB_USER_AGENT, MB_MIN_INTERVAL_MS } from "./musicbrainz.mjs";
import { enrichLastfm, readApiKey, LASTFM_USER_AGENT, LASTFM_MIN_INTERVAL_MS } from "./lastfm.mjs";
import { runLayout } from "./layout.mjs";
import { assembleData, validateData, largestMoves, loadStories, formatReport } from "./build.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../..");
const cacheDir = join(here, "cache");
const libraryFile = join(cacheDir, "library.json");
const positionsFile = join(cacheDir, "positions.json");
const outFile = join(repoRoot, "static/music/data.json");

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function main() {
  const skipExport = process.argv.includes("--skip-export");
  const overrides = await readJson(join(here, "overrides.json"), null);
  if (!overrides) throw new Error("overrides.json is missing");
  await mkdir(cacheDir, { recursive: true });

  let tracks;
  if (skipExport) {
    tracks = await readJson(libraryFile, null);
    if (!tracks) throw new Error("--skip-export needs cache/library.json from an earlier run");
  } else {
    tracks = exportLibrary();
    await writeFile(libraryFile, JSON.stringify(tracks));
  }

  const groups = groupByArtist(tracks);
  const selected = selectArtists(groups, { rule: overrides.selection, weights: overrides.loveWeights, forceIn: overrides.forceIn, forceOut: overrides.forceOut });
  console.error(`Selected ${selected.length} of ${groups.length} artists. Enriching (MusicBrainz is ~1/s, first run takes a few minutes)…`);

  const mbFetcher = createFetcher({ cacheDir: join(cacheDir, "musicbrainz"), minIntervalMs: MB_MIN_INTERVAL_MS, userAgent: MB_USER_AGENT });
  const mb = await enrichMusicBrainz(selected, { fetcher: mbFetcher, pinned: overrides.mbids });

  const apiKey = readApiKey();
  const lfmFetcher = createFetcher({ cacheDir: join(cacheDir, "lastfm"), minIntervalMs: LASTFM_MIN_INTERVAL_MS, userAgent: LASTFM_USER_AGENT });
  const lfm = await enrichLastfm(mb.artists, { fetcher: lfmFetcher, apiKey });

  const previous = await readJson(positionsFile, {});
  const layout = runLayout(lfm.artists, previous, { clusterNames: overrides.clusterNames, resolution: overrides.clusterResolution });
  const stories = await loadStories(join(here, "stories"));
  const data = assembleData({
    ...layout,
    artists: lfm.artists,
    stories,
    stats: { songs: tracks.length, artists: groups.length },
    generated: new Date().toISOString().slice(0, 10),
  });
  const errors = validateData(data, { forbiddenStrings: [apiKey] });

  if (errors.length === 0) {
    await mkdir(dirname(outFile), { recursive: true });
    await writeFile(outFile, JSON.stringify(data));
    await writeFile(positionsFile, JSON.stringify(layout.positions));
  }

  console.log(formatReport({
    trackCount: tracks.length,
    groupCount: groups.length,
    selected: selected.length,
    newIds: Object.keys(previous).length ? selected.map((artist) => artist.id).filter((id) => !previous[id]) : [],
    unmatched: mb.unmatched,
    lastfmMissing: lfm.missing,
    missingForced: missingForcedIn(groups, overrides.forceIn),
    clusters: layout.clusters,
    moves: largestMoves(previous, layout.positions),
    network: { network: mbFetcher.stats.network + lfmFetcher.stats.network, cached: mbFetcher.stats.cached + lfmFetcher.stats.cached },
    errors,
    outFile: relative(repoRoot, outFile),
  }));
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
