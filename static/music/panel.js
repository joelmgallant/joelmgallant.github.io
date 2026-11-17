const SVG_NS = "http://www.w3.org/2000/svg";

export function lineageLayout(count, radius = 90) {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

export function spotifyUrl(name) {
  return `https://open.spotify.com/search/${encodeURIComponent(name)}/artists`;
}

function element(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function svgElement(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

const plural = (count, word) => `${count.toLocaleString()} ${word}${count === 1 ? "" : "s"}`;

function renderTracks(tracks) {
  const list = element("ol", { class: "tracks" });
  for (const track of tracks.slice(0, 10)) {
    list.append(element("li", {}, element("span", { text: track.title }), element("span", { class: "plays", text: plural(track.plays, "play") })));
  }
  return element("section", {}, element("h3", { text: "Most played" }), list);
}

function renderLineageGraph(artist, items) {
  const spots = lineageLayout(items.length);
  const svg = svgElement("svg", { viewBox: "-170 -130 340 260", role: "img", "aria-label": `Bands and people connected to ${artist.name}` });
  items.forEach((item, index) => {
    const line = svgElement("line", { x1: 0, y1: 0, x2: spots[index].x, y2: spots[index].y, class: "edge" });
    line.style.setProperty("--i", index);
    svg.append(line);
  });
  svg.append(svgElement("circle", { r: 10, class: "centre" }));
  items.forEach((item, index) => {
    const group = svgElement("g", { class: item.id ? "spot on-map" : "spot outside", transform: `translate(${spots[index].x} ${spots[index].y})` });
    group.style.setProperty("--i", index);
    const label = svgElement("text", { y: 20, "text-anchor": "middle" });
    label.textContent = item.name;
    group.append(svgElement("circle", { r: 6 }), label);
    svg.append(group);
  });
  return svg;
}

function renderLineage(artist) {
  const section = element("section", { class: "lineage" }, element("h3", { text: "Lineage" }));
  if (!artist.mbid) return section.append(element("p", { class: "note", text: "No lineage found." })), section;
  if (artist.lineage.length === 0) return section.append(element("p", { class: "note", text: "No bands or members listed." })), section;
  const list = element("ul", { class: "lineage-list" });
  for (const item of artist.lineage) {
    const target = item.id
      ? element("a", { href: `#artist=${item.id}`, text: item.name })
      : element("span", { class: "outside", text: `${item.name} (not in my library)` });
    list.append(element("li", {}, element("span", { class: "relation", text: `${item.relation} ` }), target));
  }
  section.append(renderLineageGraph(artist, artist.lineage.slice(0, 12)), list);
  return section;
}

export function renderPanel(container, artist, { clusterName }) {
  const genres = artist.appleGenres.slice(0, 2).join(" / ");
  container.replaceChildren(
    element("button", { class: "close", type: "button", "aria-label": "Close", "data-close": "", text: "×" }),
    element("p", { class: "kicker", text: clusterName }),
    element("h2", { text: artist.name }),
    element("p", { class: "stats", text: `${plural(artist.songs, "song")} · ${plural(artist.plays, "play")} · ${plural(artist.favourites, "favourite")}` }),
    genres ? element("p", { class: "filed" }, "Apple files it as: ", element("s", { text: genres })) : null,
    element("a", { class: "btn spot", href: spotifyUrl(artist.name), target: "_blank", rel: "noopener", text: "Find on Spotify" }),
    renderTracks(artist.tracks),
    renderLineage(artist),
  );
  container.hidden = false;
  container.scrollTop = 0;
}

export function closePanel(container) {
  container.hidden = true;
  container.replaceChildren();
}
