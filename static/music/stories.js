import { formatHash } from "./search.js";

export function clampStep(step, story) {
  return Math.min(Math.max(0, step), story.steps.length - 1);
}

function textElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function navButton(label, hash) {
  const button = textElement("button", "btn-plain", label);
  button.type = "button";
  if (hash === null) button.disabled = true;
  else button.addEventListener("click", () => { location.hash = hash; });
  return button;
}

export function createStories({ select, box, data, map }) {
  const storiesById = new Map(data.stories.map((story) => [story.id, story]));
  for (const story of data.stories) {
    const option = textElement("option", "", story.title);
    option.value = story.id;
    select.append(option);
  }
  select.addEventListener("change", () => { location.hash = select.value ? formatHash({ story: select.value }) : ""; });
  let openStoryId = null;

  function render(story, step) {
    const current = story.steps[step];
    const isLast = step === story.steps.length - 1;
    const controls = document.createElement("div");
    controls.className = "story-controls";
    controls.append(
      navButton("Back", step > 0 ? formatHash({ story: story.id, step: step - 1 }) : null),
      navButton(isLast ? "Done" : "Next", isLast ? "#" : formatHash({ story: story.id, step: step + 1 })),
    );
    if (story.link) {
      const link = textElement("a", "story-link", story.link.label);
      link.href = story.link.href;
      controls.append(link);
    }
    box.replaceChildren(
      textElement("p", "kicker", `${story.title} · ${step + 1} of ${story.steps.length}`),
      textElement("h2", "", map.byId.get(current.artist)?.name ?? current.artist),
      textElement("p", "", current.caption),
      controls,
    );
    box.hidden = false;
  }

  return {
    open(id, step) {
      const story = storiesById.get(id);
      if (!story) return false;
      const safeStep = clampStep(step, story);
      openStoryId = id;
      select.value = id;
      map.setStory({ ids: story.steps.map((item) => item.artist), current: safeStep });
      map.flyTo(story.steps[safeStep].artist);
      render(story, safeStep);
      return true;
    },
    close() {
      if (!openStoryId) return;
      openStoryId = null;
      select.value = "";
      map.setStory(null);
      box.hidden = true;
      box.replaceChildren();
    },
  };
}
