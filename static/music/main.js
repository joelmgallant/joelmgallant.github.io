import { createMap } from "./map.js";
import { createJuice } from "./juice.js";
import { renderPanel, closePanel } from "./panel.js";
import { parseHash, formatHash, wireSearch } from "./search.js";
import { createStories } from "./stories.js";
import { toggleCluster } from "./highlight.js";

const status = document.getElementById("status");

async function loadData() {
  const response = await fetch("data.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function renderLegend(list, clusters) {
  for (const cluster of clusters) {
    const item = document.createElement("li");
    const row = document.createElement("button");
    row.type = "button";
    row.className = "legend-row";
    row.dataset.cluster = cluster.id;
    row.setAttribute("aria-pressed", "false");
    const swatch = document.createElement("i");
    swatch.style.background = cluster.color;
    row.append(swatch, cluster.name);
    item.append(row);
    list.append(item);
  }
  const clear = document.createElement("button");
  clear.type = "button";
  clear.id = "legend-clear";
  clear.hidden = true;
  clear.textContent = "Clear";
  list.after(clear);
  return clear;
}

async function start() {
  let data;
  try {
    data = await loadData();
  } catch (error) {
    status.textContent = `Couldn't load the map data (${error.message}).`;
    status.hidden = false;
    return;
  }
  document.getElementById("count").textContent =
    `${data.artists.length} artists out of ${data.stats.artists.toLocaleString()}, from ${data.stats.songs.toLocaleString()} songs.`;
  const legend = document.getElementById("legend");
  const clearButton = renderLegend(legend, data.clusters);

  const panel = document.getElementById("panel");
  const clusterName = new Map(data.clusters.map((cluster) => [cluster.id, cluster.name]));
  const juice = createJuice({ reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches });
  const map = createMap({
    canvas: document.getElementById("map"),
    data,
    juice,
    onSelect: (id) => {
      const { story, step } = parseHash(location.hash);
      if (story) { if (id) location.hash = formatHash({ story, step, artist: id }); return; }
      location.hash = id ? formatHash({ artist: id }) : "";
    },
  });
  wireSearch(document.getElementById("search"), document.getElementById("artist-names"), data.artists);
  const stories = createStories({ select: document.getElementById("stories"), box: document.getElementById("story"), data, map });

  // Genre highlight and stories are exclusive; the highlight never goes in the URL (cluster ids renumber).
  let highlight = new Set();
  function applyHighlight(next) {
    highlight = next;
    map.setHighlight(highlight);
    for (const row of legend.querySelectorAll(".legend-row")) row.setAttribute("aria-pressed", String(highlight.has(row.dataset.cluster)));
    clearButton.hidden = highlight.size === 0;
  }
  legend.addEventListener("click", (event) => {
    const row = event.target.closest(".legend-row");
    if (!row) return;
    applyHighlight(toggleCluster(highlight, row.dataset.cluster));
    const { story, artist } = parseHash(location.hash);
    if (story && highlight.size) location.hash = formatHash({ artist });
  });
  clearButton.addEventListener("click", () => applyHighlight(new Set()));

  // Closing the panel keeps an open story; Escape with no panel closes the story.
  const closeHash = () => { const { story, step } = parseHash(location.hash); return formatHash({ story, step }); };
  panel.addEventListener("click", (event) => { if (event.target.closest("[data-close]")) location.hash = closeHash(); });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!panel.hidden) location.hash = closeHash();
    else if (parseHash(location.hash).story) location.hash = "";
  });

  const narrow = window.matchMedia("(max-width: 700px)");
  // Keep the artist clear of the panel: above the bottom sheet on phones, left of the right-hand card on wide screens.
  const panelOffset = () => (narrow.matches ? [0, -0.3 * window.innerHeight] : [-(Math.min(380, window.innerWidth - 32) + 16) / 2, 0]);

  function route() {
    const { artist: artistId, story: storyId, step } = parseHash(location.hash);
    const inStory = storyId ? stories.open(storyId, step) : false;
    if (inStory && highlight.size) applyHighlight(new Set());
    if (!inStory) stories.close();
    const artist = artistId ? map.byId.get(artistId) : null;
    if (!artist) {
      map.select(null);
      closePanel(panel);
      return;
    }
    map.select(artist.id);
    if (!inStory) map.flyTo(artist.id, { screenOffset: panelOffset() });
    renderPanel(panel, artist, { clusterName: clusterName.get(artist.cluster) || "" });
  }
  window.addEventListener("hashchange", route);
  route();
}

start();
