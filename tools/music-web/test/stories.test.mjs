import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clampStep } from "../../../static/music/stories.js";

const story = JSON.parse(readFileSync(new URL("../stories/punk-to-folk.json", import.meta.url), "utf8"));

test("clampStep keeps steps inside the story", () => {
  assert.equal(clampStep(-1, story), 0);
  assert.equal(clampStep(3, story), 3);
  assert.equal(clampStep(99, story), story.steps.length - 1);
});

test("punk-to-folk story is well-formed", () => {
  assert.equal(story.id, "punk-to-folk");
  assert.ok(story.steps.length >= 5);
  for (const step of story.steps) {
    assert.match(step.artist, /^[a-z0-9-]+$/);
    assert.ok(step.caption.length > 0 && step.caption.length < 140);
  }
  assert.equal(story.link.href, "/folk-tastes/");
});
