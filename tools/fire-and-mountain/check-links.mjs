// Verifies every tarot URL answers 200 without a redirect, and every library image exists.
// Usage: node check-links.mjs [--skip-images]
import { existsSync } from 'node:fs';
import { tarotLinks } from './lib/tarot-cards.mjs';
import { libraryImages } from './lib/vocab.mjs';

const problems = [];

async function checkUrl(name, url) {
  const response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0 (link check)' } });
  if (response.status !== 200) {
    problems.push(`${response.status} ${name} ${url} -> ${response.headers.get('location') ?? ''}`);
  }
}

const entries = Object.entries(tarotLinks());
for (let index = 0; index < entries.length; index += 6) {
  await Promise.all(entries.slice(index, index + 6).map(([name, url]) => checkUrl(name, url)));
}
console.log(`tarot: checked ${entries.length} URLs`);

if (!process.argv.includes('--skip-images')) {
  const imageDir = new URL('../../static/fire-and-mountain/today/img/', import.meta.url);
  const images = libraryImages();
  for (const image of images) {
    if (!existsSync(new URL(image, imageDir))) problems.push(`missing image ${image}`);
  }
  console.log(`images: checked ${images.length} files`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`${problems.length} problem(s)`);
  process.exit(1);
}
console.log('all links OK');
