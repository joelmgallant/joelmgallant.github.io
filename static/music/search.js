export function normalise(text) {
  return String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseHash(hash) {
  const params = new URLSearchParams(String(hash).replace(/^#/, ""));
  const step = Number.parseInt(params.get("step") || "0", 10);
  return { artist: params.get("artist") || null, story: params.get("story") || null, step: Number.isFinite(step) && step >= 0 ? step : 0 };
}

export function formatHash({ artist, story, step } = {}) {
  const params = new URLSearchParams();
  if (story) {
    params.set("story", story);
    if (step) params.set("step", String(step));
  }
  if (artist) params.set("artist", artist);
  const text = params.toString();
  return text ? `#${text}` : "";
}

export function findArtists(query, artists, limit = 8) {
  const wanted = normalise(query);
  if (!wanted) return [];
  return artists
    .map((artist) => ({ artist, name: normalise(artist.name) }))
    .filter((entry) => entry.name.includes(wanted))
    .sort((left, right) =>
      Number(right.name.startsWith(wanted)) - Number(left.name.startsWith(wanted)) ||
      right.artist.love - left.artist.love ||
      left.artist.name.localeCompare(right.artist.name))
    .slice(0, limit)
    .map((entry) => entry.artist);
}

export function wireSearch(input, datalist, artists) {
  for (const artist of [...artists].sort((left, right) => left.name.localeCompare(right.name))) {
    const option = document.createElement("option");
    option.value = artist.name;
    datalist.append(option);
  }
  input.addEventListener("change", () => {
    const [match] = findArtists(input.value, artists, 1);
    if (!match) return;
    location.hash = formatHash({ artist: match.id });
    input.value = "";
    input.blur();
  });
}
