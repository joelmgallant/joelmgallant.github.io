import { createMap } from "./map.js";
import { createJuice } from "./juice.js";
import { renderPanel, closePanel } from "./panel.js";
import { parseHash, formatHash, wireSearch } from "./search.js";
import { createStories } from "./stories.js";

const status = document.getElementById("status");

async function loadData() {
  const response = await fetch("data.json", { cache: "no-cache" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function renderLegend(list, clusters) {
  for (const cluster of clusters) {
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.style.background = cluster.color;
    item.append(swatch, cluster.name);
    list.append(item);
  }
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
  renderLegend(document.getElementById("legend"), data.clusters);

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
