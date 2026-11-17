import { test } from "node:test";
import assert from "node:assert/strict";
import { createCamera, worldToScreen, screenToWorld, zoomAt, panBy, fitBounds, nodeRadius, hitTest, labelVisible, MAX_SCALE, pickLabels, trimmedBounds, centreOn } from "../../../static/music/camera.js";
import { stepSpring, isSettled, easeInOutCubic, lerpCamera, createJuice } from "../../../static/music/juice.js";
import { parseHash, formatHash, findArtists } from "../../../static/music/search.js";

const close = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);

test("world and screen coordinates round-trip", () => {
  const camera = { ...createCamera(800, 600), x: 10, y: -5, scale: 2 };
  const [sx, sy] = worldToScreen(camera, 30, 15);
  assert.deepEqual([sx, sy], [440, 340]);
  assert.deepEqual(screenToWorld(camera, sx, sy), [30, 15]);
});

test("zoomAt keeps the point under the cursor fixed and clamps scale", () => {
  const camera = createCamera(800, 600);
  const before = screenToWorld(camera, 100, 100);
  const zoomed = zoomAt(camera, 100, 100, 2);
  const after = screenToWorld(zoomed, 100, 100);
  close(after[0], before[0]);
  close(after[1], before[1]);
  assert.equal(zoomAt(camera, 0, 0, 1000).scale, MAX_SCALE);
});

test("panBy moves the camera opposite to the drag, scaled", () => {
  assert.deepEqual(panBy({ ...createCamera(100, 100), scale: 2 }, 10, -20), { x: -5, y: 10, scale: 2, width: 100, height: 100 });
});

test("fitBounds centres on the points", () => {
  const fitted = fitBounds(createCamera(400, 400), [{ x: -100, y: 0 }, { x: 100, y: 50 }], { padding: 0 });
  assert.deepEqual([fitted.x, fitted.y, fitted.scale], [0, 25, 2]);
});

test("nodeRadius, hitTest and labelVisible", () => {
  assert.equal(nodeRadius(0), 2);
  assert.equal(nodeRadius(100), 18);
  const nodes = [{ id: "a", x: 0, y: 0, r: 5 }, { id: "b", x: 8, y: 0, r: 5 }];
  assert.equal(hitTest(nodes, 6, 0, 0).id, "b");
  assert.equal(hitTest(nodes, 50, 50, 0), null);
  assert.equal(labelVisible(3, 2, false), false);
  assert.equal(labelVisible(5, 2, false), true);
  assert.equal(labelVisible(1, 1, true), true);
});

test("springs settle on their target", () => {
  let spring = { value: 0, velocity: 0 };
  for (let frame = 0; frame < 240; frame++) spring = stepSpring(spring, 1, 1 / 60);
  assert.ok(isSettled(spring, 1), JSON.stringify(spring));
});

test("easing and camera interpolation hit their endpoints", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  close(easeInOutCubic(0.5), 0.5);
  const from = { x: 0, y: 0, scale: 1, width: 1, height: 1 };
  const to = { x: 10, y: 20, scale: 4, width: 1, height: 1 };
  assert.deepEqual(lerpCamera(from, to, 1), to);
  close(lerpCamera(from, to, 0.5).scale, 2);
});

test("juice wobbles neighbours, then settles", () => {
  const juice = createJuice({ reducedMotion: false });
  juice.poke({ id: "a", x: 0, y: 0 }, [{ node: { id: "b", x: 10, y: 0 }, weight: 1 }]);
  assert.equal(juice.step(1 / 60, 0), true);
  assert.ok(juice.offset("b")[0] > 0, "neighbour pushed away");
  for (let frame = 0; frame < 600; frame++) juice.step(1 / 60, 0);
  assert.equal(juice.step(1 / 60, 0), false);
  assert.deepEqual(juice.offset("b"), [0, 0]);
});

test("juice swells the hovered node and fades pulses", () => {
  const juice = createJuice({ reducedMotion: false });
  juice.hover("a");
  for (let frame = 0; frame < 120; frame++) juice.step(1 / 60, 0);
  close(juice.scale("a"), 1.35, 0.02);
  juice.pulse(1, 2, 1000);
  assert.equal(juice.activePulses(1300)[0].progress, 0.5);
  assert.deepEqual(juice.activePulses(1700), []);
});

test("reduced motion skips wobble and pulses but still marks hover", () => {
  const juice = createJuice({ reducedMotion: true });
  juice.poke({ id: "a", x: 0, y: 0 }, [{ node: { id: "b", x: 10, y: 0 }, weight: 1 }]);
  juice.pulse(0, 0, 0);
  juice.hover("a");
  assert.deepEqual(juice.offset("b"), [0, 0]);
  assert.deepEqual(juice.activePulses(1), []);
  assert.equal(juice.scale("a"), 1.35);
  assert.equal(juice.step(1 / 60, 0), false);
});

test("hash routes round-trip", () => {
  assert.deepEqual(parseHash("#artist=noah-kahan"), { artist: "noah-kahan", story: null, step: 0 });
  assert.deepEqual(parseHash("#story=punk-to-folk&step=3"), { artist: null, story: "punk-to-folk", step: 3 });
  assert.deepEqual(parseHash("#step=-2"), { artist: null, story: null, step: 0 });
  assert.equal(formatHash({ story: "punk-to-folk", step: 2 }), "#story=punk-to-folk&step=2");
  assert.equal(formatHash({ story: "punk-to-folk", step: 0 }), "#story=punk-to-folk");
  assert.equal(formatHash({ artist: "noah-kahan" }), "#artist=noah-kahan");
  assert.equal(formatHash({}), "");
});

test("findArtists ranks prefix matches, then love", () => {
  const artists = [
    { id: "a", name: "The Menzingers", love: 200 },
    { id: "b", name: "Menzies Band", love: 5 },
    { id: "c", name: "Måneskin", love: 1 },
  ];
  assert.deepEqual(findArtists("menz", artists).map((artist) => artist.id), ["b", "a"]);
  assert.deepEqual(findArtists("maneskin", artists).map((artist) => artist.id), ["c"]);
  assert.deepEqual(findArtists("  ", artists), []);
});

test("findArtists puts an exact name match first", () => {
  const artists = [{ id: "idina", name: "Idina Menzel", love: 100 }, { id: "id", name: "ID", love: 2 }];
  assert.deepEqual(findArtists("ID", artists).map((artist) => artist.id), ["id", "idina"]);
});

const label = (id, x, extra = {}) => ({ id, x, y: 0, width: 40, height: 14, emphasised: false, love: 1, ...extra });

test("pickLabels keeps the higher-love label in an overlap", () => {
  const kept = pickLabels([label("small", 10, { love: 2 }), label("big", 20, { love: 90 })]);
  assert.deepEqual(kept, ["big"]);
});

test("pickLabels lets emphasised beat love, and always draws emphasised", () => {
  assert.deepEqual(pickLabels([label("loved", 10, { love: 99 }), label("picked", 20, { emphasised: true })]), ["picked"]);
  const both = pickLabels([label("a", 10, { emphasised: true }), label("b", 20, { emphasised: true })]);
  assert.deepEqual(both, ["a", "b"]);
});

test("pickLabels keeps labels that do not overlap and uses the measure callback", () => {
  assert.deepEqual(pickLabels([label("a", 0), label("b", 100), label("c", 0, { y: 30 })]), ["a", "b", "c"]);
  const measured = pickLabels([{ id: "a", x: 0, y: 0, love: 2 }, { id: "b", x: 50, y: 0, love: 1 }], () => ({ width: 100, height: 14 }));
  assert.deepEqual(measured, ["a"]);
});

test("trimmedBounds drops outliers per axis", () => {
  const cluster = Array.from({ length: 98 }, (_, index) => ({ x: index % 10, y: Math.floor(index / 10) }));
  const points = [...cluster, { x: 5000, y: -5000 }, { x: -5000, y: 5000 }];
  const bounds = trimmedBounds(points, 0.03);
  assert.ok(bounds.maxX <= 9 && bounds.minX >= 0 && bounds.maxY <= 9 && bounds.minY >= 0);
  assert.equal(trimmedBounds(points, 0).maxX, 5000);
});

test("fitBounds with trim ignores outliers and zooms in much further", () => {
  const cluster = Array.from({ length: 98 }, (_, index) => ({ x: index % 10, y: Math.floor(index / 10) }));
  const points = [...cluster, { x: 5000, y: -5000 }, { x: -5000, y: 5000 }];
  const camera = createCamera(800, 600);
  const plain = fitBounds(camera, points, { padding: 0 });
  const trimmed = fitBounds(camera, points, { padding: 0, trim: 0.03 });
  assert.ok(trimmed.scale > plain.scale * 10, `${trimmed.scale} vs ${plain.scale}`);
});

test("centreOn places the point at the screen offset from centre", () => {
  const target = centreOn(createCamera(800, 600), 100, 50, 2, [-100, -30]);
  assert.deepEqual([target.x, target.y, target.scale], [150, 65, 2]);
  const [screenX, screenY] = worldToScreen(target, 100, 50);
  assert.deepEqual([screenX, screenY], [400 - 100, 300 - 30]);
  assert.equal(centreOn(createCamera(10, 10), 3, 4, 1).x, 3);
});

test("wheelPixels converts line and page deltas to pixels", async () => {
  const { wheelPixels } = await import("../../../static/music/map-input.js");
  assert.equal(wheelPixels({ deltaY: 3, deltaMode: 0 }, 800), 3);
  assert.equal(wheelPixels({ deltaY: 3, deltaMode: 1 }, 800), 48);
  assert.equal(wheelPixels({ deltaY: 2, deltaMode: 2 }, 800), 1600);
});

test("toggleCluster adds, removes and never mutates its input", async () => {
  const { toggleCluster } = await import("../../../static/music/highlight.js");
  const start = new Set([1]);
  const added = toggleCluster(start, 2);
  assert.deepEqual([...added].sort(), [1, 2]);
  assert.deepEqual([...toggleCluster(added, 1)], [2]);
  assert.deepEqual([...start], [1]);
  assert.notEqual(added, start);
});

test("isDimmed covers story and highlight modes", async () => {
  const { isDimmed } = await import("../../../static/music/highlight.js");
  const node = { id: "a", cluster: 3 };
  assert.equal(isDimmed(node, { storyIds: null, highlight: null }), false);
  assert.equal(isDimmed(node, { storyIds: null, highlight: new Set([3]) }), false);
  assert.equal(isDimmed(node, { storyIds: null, highlight: new Set([4]) }), true);
  assert.equal(isDimmed(node, { storyIds: new Set(["b"]), highlight: null }), true);
});

test("highlightedNodes returns exactly the members of the highlighted clusters", async () => {
  const { highlightedNodes } = await import("../../../static/music/highlight.js");
  const nodes = [{ id: "a", cluster: 1 }, { id: "b", cluster: 2 }, { id: "c", cluster: 3 }, { id: "d", cluster: 1 }];
  assert.deepEqual(highlightedNodes(nodes, new Set([1, 3])).map((node) => node.id), ["a", "c", "d"]);
  assert.deepEqual(highlightedNodes(nodes, new Set()), []);
});
