# Music Web (design)

**Date:** 2026-11-17
**Status:** Approved in brainstorming, awaiting spec review
**Grew out of:** `static/folk-tastes/index.html` (live at https://joelmgallant.com/folk-tastes/)

## 1. Goal

An interactive map of Joel's musical taste at `/music/`. Zoomed out, the artists he actually listens to sit in clusters by sound. Clicking an artist opens their real-world lineage (bands, members, side projects, solo careers). Hand-written "stories" trace paths across the map; the first one is the punk-to-folk pipeline from `/folk-tastes/`.

Everything is static. A local script reads the Music library on Joel's Mac, enriches it, and writes one data file that is committed and pushed. There is no backend and no API key in the browser.

Out of scope for v1: stories beyond punk-to-folk, automatic or scheduled refreshes, Last.fm scrobble history, audio previews.

## 2. Decisions

| Topic | Decision |
| --- | --- |
| Global grouping | Sound clusters from Last.fm similarity (community detection), named from dominant tags; names overridable |
| Drill-down | Real-world lineage from MusicBrainz artist relationships |
| Who's on the map | Artists Joel actually listens to: 3+ tracks, or any favourited track, or 10+ plays; tunable, overridable, target ~150–300 |
| Freshness | Re-run a local script when Joel wants, then commit and push (publish immediately, same as folk-tastes) |
| Data sources | Apple Music library (JXA), MusicBrainz (no key, 1 req/s), Last.fm (key in `~/.secrets/tokens/lastfm-api-key`) |
| Rendering | Layout pre-computed offline (seeded force layout); browser draws a stable canvas map with pan/zoom |
| Juice | Hover swell, neighbours spring-wobble around fixed positions, click pulse, gliding camera, animated lineage; all off under `prefers-reduced-motion` |
| Published data | Selected artists, clusters, positions, lineage, per-artist songs / plays / favourites, and track titles with play counts |
| Not published | Dates added, the raw library dump, artists below the selection rule |
| folk-tastes | Stays at its URL, gains a link to `/music/#story=punk-to-folk`; the story links back |
| Front-end stack | Vanilla JS modules + canvas 2D, no framework, no build step (same approach as the homepage ball) |
| Voice | Joel's: dry, short, plain, honest parentheticals; no punchline on every element, no "(made up)" hedges |

## 3. Files

```
tools/music-web/
  package.json            # "type": "module"; deps: d3-force (offline layout only)
  refresh.mjs             # runs every stage in order and prints the report
  export-library.mjs      # JXA via osascript -> cache/library.json
  select.mjs              # selection rule + overrides -> cache/selected.json
  musicbrainz.mjs         # match + relations + tags, disk-cached
  lastfm.mjs              # similar artists + top tags, disk-cached
  layout.mjs              # similarity graph, clusters, seeded positions
  build.mjs               # writes static/music/data.json + validates it
  overrides.json          # force in/out, pinned MBIDs, cluster names (committed)
  stories/punk-to-folk.json
  cache/                  # gitignored: raw library, API responses, previous positions
  test/*.test.mjs         # node:test
  test/fixtures/          # recorded MusicBrainz / Last.fm responses

static/music/
  index.html
  map.js                  # canvas drawing, pan/zoom/pinch, level-of-detail labels
  juice.js                # springs, pulses, camera easing
  panel.js                # drill-down: stats, top tracks, lineage mini-graph
  stories.js              # story mode
  search.js               # search + deep links
  data.json               # generated
```

Each front-end module stays well under 200 lines; split further if one grows past that.

## 4. Pipeline

1. **Export.** `osascript -l JavaScript` reads every library track: name, artist, album, genre, year, played count, favourited. Written to `cache/library.json` (gitignored).
2. **Select.** Group by artist on a normalised name. A credit like "Noah Kahan & Hozier" is split into both artists **only when every part already exists as an artist in the library on its own**; otherwise the credit is one artist. This keeps "Mumford & Sons", "Florence + the Machine" and "Hootie & The Blowfish" whole. Keep artists matching the rule in section 2, apply `overrides.json` force-in/force-out.
3. **MusicBrainz.** Search each artist; accept only a high search score plus a normalised-name match. Anything else goes on the unmatched list and gets no lineage. `overrides.json` can pin an MBID. For matched artists, fetch artist relationships (member of band, subgroup, is person) and genre tags. 1 request per second, `User-Agent` with a generic app name and contact URL (no personal email), responses cached on disk so re-runs only fetch what's new.
4. **Last.fm.** `artist.getSimilar` and `artist.getTopTags` for each selected artist, cached on disk. The key is read from the token file at run time and never written into the repo or output.
5. **Layout.** Build a weighted graph between selected artists from Last.fm similarity (MusicBrainz shared tags as a fallback, Apple genre as a last resort). Detect communities for clusters; name each from its most common tags unless `overrides.json` names it. Run d3-force with a fixed seed, starting from `cache/positions.json` (the previous run's positions) so existing artists barely move when new ones arrive.
6. **Build.** Write `static/music/data.json`, run the validator, print the report.

### data.json shape

```json
{
  "generated": "2026-11-17",
  "clusters": [{ "id": "c3", "name": "Folk (filed under anything but)", "color": "#3f6b3a" }],
  "artists": [{
    "id": "noah-kahan",
    "name": "Noah Kahan",
    "mbid": "…",
    "cluster": "c3",
    "x": 412.5, "y": -88.1,
    "songs": 62, "plays": 0, "favourites": 0,
    "appleGenres": ["Alternative"],
    "tracks": [{ "title": "…", "plays": 0 }],
    "similar": [{ "id": "…", "weight": 0.66 }],
    "lineage": [{ "relation": "member of", "name": "…", "mbid": "…", "id": "…or null if not on the map" }]
  }],
  "stories": [{ "id": "punk-to-folk", "title": "…", "steps": [{ "artist": "frank-turner", "caption": "…" }] }]
}
```

Numbers above are placeholders for the shape only; real values come from the run.

## 5. Front end

- **Map.** Full-viewport canvas. Dot size from a love score, `songs + plays / 5 + favourites * 3` (weights live in `overrides.json` so they can be tuned without code changes), with radius proportional to its square root; colour from cluster. Labels by zoom level: only the biggest names when zoomed out. Similarity lines appear only for the hovered or selected artist.
- **Juice.** Hover: the dot swells, neighbours wobble on damped springs, then return to their fixed spots. Click: pulse ring and the camera glides to the artist. Lineage graph animates in.
- **Drill-down panel.** Side panel on desktop, bottom sheet on phones. Shows songs / plays / favourites, "Apple files it as: …", top tracks by plays, Spotify artist-search button, and the lineage mini-graph. Lineage entries on the map fly the camera there; entries not in the library are greyed and labelled "not in my library".
- **Stories.** A Stories menu. Choosing one dims the map, lights the path, and steps through captions with Next / Back.
- **Search and deep links.** Search flies to an artist. `#artist=<id>` and `#story=<id>` open directly.
- **Failure.** If `data.json` fails to load, say so in plain text.
- **Accessibility.** Keyboard: Tab through search, story controls and panel; arrow keys pan; Escape closes the panel. Reduced motion disables springs and camera easing.

## 6. Error handling and the report

- No silent guesses: low-confidence MusicBrainz matches are left unmatched and listed.
- Artists without Last.fm data fall back to tag or genre placement and are listed.
- HTTP 429/503: retry with backoff. Progress is cached, so an interrupted run resumes.
- The report at the end of every run states counts: tracks read, artists selected, matched, unmatched (with names), new since last run, largest position moves, validator result. It reports what was done, not just an exit code.

## 7. Testing

- `node:test` unit tests for pure functions: selection rule, name normalisation and duet splitting, MusicBrainz match acceptance, love score, cluster naming, and layout stability (add one artist to a fixture graph, re-run, existing nodes move less than a small threshold).
- Fixtures: recorded MusicBrainz and Last.fm responses; tests never touch the network.
- Build validator: schema check, every story artist exists, every lineage `id` resolves, no duplicate ids, no token strings in the output.
- Visual check before each publish: headless Chrome screenshots at desktop and phone widths.

## 8. Rollout

1. Pipeline and `data.json`, with the report reviewed by Claude (unmatched list, cluster names sanity-checked). Nothing visible is published at this step.
2. Map + juice + drill-down. First publish of `/music/`.
3. Punk-to-folk story and the link from `/folk-tastes/`.

From step 2 on, each step is published as it lands.
