import { createMap } from "./map.js";
import { createJuice } from "./juice.js";
import { renderPanel, closePanel } from "./panel.js";
import { parseHash, formatHash, wireSearch } from "./search.js";

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
    onSelect: (id) => { location.hash = id ? formatHash({ artist: id }) : ""; },
  });
  wireSearch(document.getElementById("search"), document.getElementById("artist-names"), data.artists);

  panel.addEventListener("click", (event) => { if (event.target.closest("[data-close]")) location.hash = ""; });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !panel.hidden) location.hash = ""; });

  const narrow = window.matchMedia("(max-width: 700px)");
  // Keep the artist clear of the panel: above the bottom sheet on phones, left of the right-hand card on wide screens.
  const panelOffset = () => (narrow.matches ? [0, -0.3 * window.innerHeight] : [-(Math.min(380, window.innerWidth - 32) + 16) / 2, 0]);

  function route() {
    const { artist: artistId } = parseHash(location.hash);
    const artist = artistId ? map.byId.get(artistId) : null;
    if (!artist) {
      map.select(null);
      closePanel(panel);
      return;
    }
    map.select(artist.id);
    map.flyTo(artist.id, { screenOffset: panelOffset() });
    renderPanel(panel, artist, { clusterName: clusterName.get(artist.cluster) || "" });
  }
  window.addEventListener("hashchange", route);
  route();
}

start();
