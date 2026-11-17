import { execFileSync } from "node:child_process";

export const JXA_SCRIPT = `
const tracks = Application("Music").libraryPlaylists[0].tracks;
JSON.stringify({
  title: tracks.name(),
  artist: tracks.artist(),
  album: tracks.album(),
  genre: tracks.genre(),
  year: tracks.year(),
  plays: tracks.playedCount(),
  favourite: tracks.favorited()
});`;

export function rowsFromColumns(columns) {
  const count = columns.title.length;
  for (const [key, values] of Object.entries(columns)) {
    if (values.length !== count) throw new Error(`column ${key} has ${values.length} values, expected ${count}`);
  }
  const rows = [];
  for (let index = 0; index < count; index++) {
    rows.push({
      title: columns.title[index] || "",
      artist: (columns.artist[index] || "").trim(),
      album: columns.album[index] || "",
      genre: columns.genre[index] || "",
      year: columns.year[index] || null,
      plays: columns.plays[index] || 0,
      favourite: columns.favourite[index] === true,
    });
  }
  return rows;
}

export function exportLibrary() {
  const output = execFileSync("osascript", ["-l", "JavaScript", "-e", JXA_SCRIPT], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const rows = rowsFromColumns(JSON.parse(output));
  if (rows.length === 0) throw new Error("Music library export returned 0 tracks");
  return rows;
}
