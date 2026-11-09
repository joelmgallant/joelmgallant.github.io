// Allowed values for reading content, and the illustration file each one maps to.
export const STONES = ['ruby', 'onyx', 'pearl', 'diamonds-stacked', 'diamond'];
export const ELEMENTS = ['earth', 'fire', 'water', 'wind', 'heart'];
export const EMBLEMS = { joel: ['fire-tiger', 'cabin'], nancy: ['wood-rat', 'shore'] };
export const MOODS = ['mischief', 'rest', 'courage', 'crossing', 'feast', 'focus', 'wonder',
  'homecoming', 'celebration', 'patience', 'spark', 'release'];
export const PHASES = ['new', 'waxing-crescent', 'first-quarter', 'waxing-gibbous', 'full',
  'waning-gibbous', 'last-quarter', 'waning-crescent'];

/** Every illustration file the today page can reference (34). */
export function libraryImages() {
  return [
    ...PHASES.map((phase) => `moon-${phase}.webp`),
    ...STONES.map((stone) => `stone-${stone}.webp`),
    ...ELEMENTS.map((element) => `element-${element}.webp`),
    ...[...EMBLEMS.joel, ...EMBLEMS.nancy].map((emblem) => `emblem-${emblem}.webp`),
    ...MOODS.map((mood) => `mood-${mood}.webp`),
  ];
}
