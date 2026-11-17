import { test } from "node:test";
import assert from "node:assert/strict";
import { rowsFromColumns } from "../export-library.mjs";

test("rowsFromColumns zips JXA columns into track rows", () => {
  const rows = rowsFromColumns({
    title: ["Smoking Rooms", "Hozier Song"],
    artist: ["Aaron West and The Roaring Twenties ", ""],
    album: ["In Lieu of Flowers", null],
    genre: ["Rock", ""],
    year: [2024, 0],
    plays: [13, 0],
    favourite: [false, true],
  });
  assert.deepEqual(rows, [
    { title: "Smoking Rooms", artist: "Aaron West and The Roaring Twenties", album: "In Lieu of Flowers", genre: "Rock", year: 2024, plays: 13, favourite: false },
    { title: "Hozier Song", artist: "", album: "", genre: "", year: null, plays: 0, favourite: true },
  ]);
});

test("rowsFromColumns refuses mismatched columns", () => {
  assert.throws(
    () => rowsFromColumns({ title: ["a", "b"], artist: ["x"], album: [], genre: [], year: [], plays: [], favourite: [] }),
    /column artist has 1 values, expected 2/,
  );
});
