function stripDiacritics(text) {
  return String(text).normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

export function normalizeName(name) {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "")
    .replace(/\s+/g, " ");
}

export function slugify(name) {
  const slug = stripDiacritics(name)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "artist";
}

const CREDIT_SEPARATOR = /\s*(?:,|&|\+|\bfeat\.?|\bft\.?|\bx\b|\band\b|\bwith\b)\s*/i;

export function splitCredit(credit, knownNames) {
  const parts = credit.split(CREDIT_SEPARATOR).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return [credit];
  const everyPartKnown = parts.every((part) => knownNames.has(normalizeName(part)));
  return everyPartKnown ? parts : [credit];
}
