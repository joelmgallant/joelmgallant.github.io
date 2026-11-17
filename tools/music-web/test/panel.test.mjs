import { test } from "node:test";
import assert from "node:assert/strict";
import { lineageLayout, spotifyUrl } from "../../../static/music/panel.js";

test("lineageLayout spaces items evenly on a circle, starting at the top", () => {
  const spots = lineageLayout(4, 100);
  assert.equal(spots.length, 4);
  assert.ok(Math.abs(spots[0].x) < 1e-9 && Math.abs(spots[0].y + 100) < 1e-9);
  for (const spot of spots) assert.ok(Math.abs(Math.hypot(spot.x, spot.y) - 100) < 1e-9);
  assert.deepEqual(lineageLayout(0), []);
});

test("spotifyUrl searches artists", () => {
  assert.equal(spotifyUrl("Mumford & Sons"), "https://open.spotify.com/search/Mumford%20%26%20Sons/artists");
});
