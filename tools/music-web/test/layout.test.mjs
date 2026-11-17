import { test } from "node:test";
import assert from "node:assert/strict";
import { mulberry32, buildEdges, detectCommunities, nameClusters, computePositions, runLayout, MISC_CLUSTER } from "../layout.mjs";

const artist = (id, name, extra = {}) => ({ id, name, appleGenres: [], mbGenres: [], lfmSimilar: [], lfmTags: [], ...extra });

test("mulberry32 is deterministic per seed", () => {
  const first = mulberry32(7), second = mulberry32(7);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

test("buildEdges uses Last.fm similarity, then tags, then Apple genre", () => {
  const artists = [
    artist("noah-kahan", "Noah Kahan", { lfmSimilar: [{ name: "Gregory Alan Isakov", match: 0.66 }, { name: "Not In Library", match: 0.9 }] }),
    artist("gregory-alan-isakov", "Gregory Alan Isakov", { lfmSimilar: [{ name: "Noah Kahan", match: 0.5 }] }),
    artist("tag-a", "Tag A", { lfmTags: [{ name: "folk", count: 100 }, { name: "indie", count: 50 }] }),
    artist("tag-b", "Tag B", { mbGenres: ["folk", "indie"] }),
    artist("genre-a", "Genre A", { appleGenres: ["Comedy"] }),
    artist("genre-b", "Genre B", { appleGenres: ["Comedy"] }),
  ];
  assert.deepEqual(buildEdges(artists), [
    { source: "genre-a", target: "genre-b", weight: 0.1 },
    { source: "gregory-alan-isakov", target: "noah-kahan", weight: 0.66 },
    { source: "tag-a", target: "tag-b", weight: 0.5 },
  ]);
});

function twoTriangles() {
  const ids = ["a1", "a2", "a3", "b1", "b2", "b3", "lonely"];
  const edges = [
    { source: "a1", target: "a2", weight: 1 }, { source: "a1", target: "a3", weight: 1 }, { source: "a2", target: "a3", weight: 1 },
    { source: "b1", target: "b2", weight: 1 }, { source: "b1", target: "b3", weight: 1 }, { source: "b2", target: "b3", weight: 1 },
    { source: "a3", target: "b1", weight: 0.05 },
  ];
  return { ids, edges };
}

test("detectCommunities finds the two triangles and sends small groups to misc", () => {
  const { ids, edges } = twoTriangles();
  const clusterOf = detectCommunities(ids, edges);
  assert.equal(clusterOf.get("a1"), clusterOf.get("a2"));
  assert.equal(clusterOf.get("a1"), clusterOf.get("a3"));
  assert.equal(clusterOf.get("b1"), clusterOf.get("b3"));
  assert.notEqual(clusterOf.get("a1"), clusterOf.get("b1"));
  assert.equal(clusterOf.get("lonely"), MISC_CLUSTER);
  assert.deepEqual(new Set(clusterOf.values()), new Set(["c0", "c1", MISC_CLUSTER]));
  assert.deepEqual(detectCommunities(ids, edges), clusterOf, "same input, same clusters");
});

test("nameClusters uses tags, bans 'alternative', and honours overrides", () => {
  const clusterOf = new Map([["x", "c0"], ["y", "c0"], ["z", "c1"], ["w", MISC_CLUSTER]]);
  const artists = [
    artist("x", "X", { lfmTags: [{ name: "alternative", count: 100 }, { name: "folk", count: 100 }, { name: "folk punk", count: 50 }] }),
    artist("y", "Y", { lfmTags: [{ name: "folk", count: 80 }] }),
    artist("z", "Z", { lfmTags: [{ name: "pop punk", count: 100 }] }),
    artist("w", "W"),
  ];
  const named = nameClusters(clusterOf, artists, { z: "Pop punk, obviously" });
  assert.deepEqual(named.map(({ id, name, size }) => ({ id, name, size })), [
    { id: "c0", name: "Folk / Folk Punk", size: 2 },
    { id: "c1", name: "Pop punk, obviously", size: 1 },
    { id: MISC_CLUSTER, name: "Everything else", size: 1 },
  ]);
  assert.match(named[0].color, /^#[0-9a-f]{6}$/);
});

test("computePositions is deterministic and finite", () => {
  const { ids, edges } = twoTriangles();
  const first = computePositions(ids, edges);
  assert.deepEqual(computePositions(ids, edges), first);
  for (const id of ids) assert.ok(Number.isFinite(first[id].x) && Number.isFinite(first[id].y));
});

test("adding an artist barely moves the existing map", () => {
  const ids = Array.from({ length: 30 }, (_, index) => `n${String(index).padStart(2, "0")}`);
  const edges = ids.map((id, index) => ({ source: id, target: ids[(index + 1) % ids.length], weight: 0.8 }))
    .map((edge) => (edge.source < edge.target ? edge : { ...edge, source: edge.target, target: edge.source }));
  const before = computePositions(ids, edges);
  const after = computePositions([...ids, "zz-new"], [...edges, { source: "n00", target: "zz-new", weight: 0.9 }, { source: "n15", target: "zz-new", weight: 0.9 }], before);
  const largestMove = Math.max(...ids.map((id) => Math.hypot(after[id].x - before[id].x, after[id].y - before[id].y)));
  assert.ok(largestMove < 15, `existing nodes moved up to ${largestMove.toFixed(1)}`);
  assert.ok(Number.isFinite(after["zz-new"].x));
  const between = (from, to) => Math.hypot(after[from].x - after[to].x, after[from].y - after[to].y);
  const detour = between("zz-new", "n00") + between("zz-new", "n15") - between("n00", "n15");
  assert.ok(detour < 30, `zz-new settled ${detour.toFixed(1)} off the line between its two neighbours`);
  assert.deepEqual(Object.keys(after["zz-new"]).sort(), ["x", "y"]);
});

test("runLayout wires the pieces together", () => {
  const artists = ["a", "b", "c"].map((id) => artist(id, id.toUpperCase(), { appleGenres: ["Rock"] }));
  const result = runLayout(artists, {}, {});
  assert.equal(Object.keys(result.positions).length, 3);
  assert.equal(result.clusterOf.size, 3);
  assert.ok(result.clusters.length >= 1);
  assert.ok(result.edges.length >= 1);
});
