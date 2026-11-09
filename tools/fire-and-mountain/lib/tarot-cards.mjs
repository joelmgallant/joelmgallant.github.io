// The 78-card Rider-Waite-Smith deck as named in readings, with Biddy Tarot slugs.
const BASE = 'https://biddytarot.com/tarot-card-meanings';

const MAJORS = [
  ['The Fool', 'fool'], ['The Magician', 'magician'], ['The High Priestess', 'high-priestess'],
  ['The Empress', 'empress'], ['The Emperor', 'emperor'], ['The Hierophant', 'hierophant'],
  ['The Lovers', 'lovers'], ['The Chariot', 'chariot'], ['Strength', 'strength'],
  ['The Hermit', 'hermit'], ['Wheel of Fortune', 'wheel-of-fortune'], ['Justice', 'justice'],
  ['The Hanged Man', 'hanged-man'], ['Death', 'death'], ['Temperance', 'temperance'],
  ['The Devil', 'devil'], ['The Tower', 'tower'], ['The Star', 'star'], ['The Moon', 'moon'],
  ['The Sun', 'sun'], ['Judgement', 'judgement'], ['The World', 'world'],
];

const RANKS = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Page', 'Knight', 'Queen', 'King'];
const SUITS = ['Cups', 'Pentacles', 'Swords', 'Wands'];

/** Map of card name to its Biddy Tarot meaning page. */
export function tarotLinks() {
  const links = {};
  for (const [name, slug] of MAJORS) links[name] = `${BASE}/major-arcana/${slug}/`;
  for (const suit of SUITS) {
    const suitSlug = suit.toLowerCase();
    for (const rank of RANKS) {
      links[`${rank} of ${suit}`] = `${BASE}/minor-arcana/suit-of-${suitSlug}/${rank.toLowerCase()}-of-${suitSlug}/`;
    }
  }
  return links;
}

/** The seven cards from Joel and Nancy's reversed Shadowscapes spread. */
export const SPREAD_CARDS = ['The Sun', 'Knight of Pentacles', 'Six of Swords', 'Six of Pentacles',
  'Knight of Wands', 'Nine of Cups', 'Eight of Swords'];
