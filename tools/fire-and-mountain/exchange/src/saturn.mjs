// Saturn's rules for Wrong Answers Only: each picks a winner between two answers by an absurd, checkable rule.
const characters = (text) => text.trim().length;
const vowels = (text) => (text.match(/[aeiou]/gi) ?? []).length;
const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const alphabetical = (first, second) => second.trim().localeCompare(first.trim(), 'en', { sensitivity: 'base' });

/** compare(joel, nancy) > 0 means Joel wins, < 0 Nancy wins, 0 a tie. */
export const SATURN_RULES = {
  shortest: { line: 'Saturn rewards brevity.', compare: (joel, nancy) => characters(nancy) - characters(joel) },
  longest: { line: 'Saturn was paid by the word.', compare: (joel, nancy) => characters(joel) - characters(nancy) },
  mostVowels: { line: 'Saturn is collecting vowels this week.', compare: (joel, nancy) => vowels(joel) - vowels(nancy) },
  firstAlphabetically: { line: 'Saturn files everything alphabetically.', compare: alphabetical },
  lastAlphabetically: { line: 'Saturn reads the dictionary backwards.', compare: (joel, nancy) => -alphabetical(joel, nancy) },
  mostWords: { line: 'Saturn counts words, not quality.', compare: (joel, nancy) => words(joel) - words(nancy) },
  fewestWords: { line: 'Saturn has a short attention span.', compare: (joel, nancy) => words(nancy) - words(joel) },
};

export function judge(ruleId, joelText, nancyText) {
  const result = SATURN_RULES[ruleId].compare(joelText, nancyText);
  if (result > 0) return 'joel';
  if (result < 0) return 'nancy';
  return 'tie';
}
