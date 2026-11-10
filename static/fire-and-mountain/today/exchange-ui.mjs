// Shared DOM helpers for The Exchange.
export const NAMES = { joel: 'Joel', nancy: 'Nancy' };

export const element = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
};

export const plainPrompt = (text) => text.replace(/\[\[([^\]]+)\]\]/g, '$1');

export function answerCard(person, answer, { label } = {}) {
  const card = element('div', { className: `answer-card ${person}` },
    element('p', { className: 'answer-name', textContent: label ?? NAMES[person] }));
  if (!answer) {
    card.append(element('p', { className: 'answer-empty', textContent: 'No answer this round.' }));
    return card;
  }
  if (answer.text) card.append(element('p', { className: 'answer-text', textContent: answer.text }));
  if (answer.photoUrl) card.append(element('img', { className: 'answer-photo', src: answer.photoUrl, alt: `${NAMES[person]}'s photo` }));
  if (answer.audioUrl) card.append(element('audio', { className: 'answer-audio', src: answer.audioUrl, controls: true, preload: 'none' }));
  return card;
}
