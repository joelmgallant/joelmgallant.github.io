// Generates the illustration library with fal nano-banana/edit, using art/reference.jpg
// as the style reference, then exports WebP files to static/fire-and-mountain/today/img/.
// Costs money per image. Skips images whose original already exists.
// Usage: node art.mjs [name ...]      (no names = every missing image)
//        node art.mjs --export-only   (re-export WebP from existing originals)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';

const here = (path) => new URL(path, import.meta.url).pathname;
const MODEL = 'fal-ai/nano-banana/edit';
const { style, images } = JSON.parse(readFileSync(here('./art/prompts.json'), 'utf8'));
const key = readFileSync(`${homedir()}/.secrets/tokens/fal-api-key`, 'utf8').trim();
const reference = `data:image/jpeg;base64,${readFileSync(here('./art/reference.jpg')).toString('base64')}`;
const originalsDir = here('./art/originals/');
const outDir = here('../../static/fire-and-mountain/today/img/');
mkdirSync(originalsDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

async function generate(name, { aspect, scene }) {
  const response = await fetch(`https://fal.run/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `${style}\n\nScene: ${scene}`, image_urls: [reference],
      num_images: 1, output_format: 'png', aspect_ratio: aspect }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status} ${JSON.stringify(body).slice(0, 300)}`);
  const url = body.images?.[0]?.url;
  if (!url) throw new Error(`${name}: no image in response ${JSON.stringify(body).slice(0, 300)}`);
  const png = Buffer.from(await (await fetch(url)).arrayBuffer());
  writeFileSync(`${originalsDir}${name}.png`, png);
  return body.images[0];
}

/** Mean brightness 0..1, to catch the all-black safety-checker image. */
function meanBrightness(path) {
  return Number(execFileSync('magick', [path, '-colorspace', 'Gray', '-format', '%[fx:mean]', 'info:']).toString());
}

function exportWebp(name) {
  const source = `${originalsDir}${name}.png`;
  execFileSync('magick', [source, '-resize', '800x800>', '-quality', '78', `${outDir}${name}.webp`]);
}

const exportOnly = process.argv.includes('--export-only');
const requested = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const names = requested.length ? requested : Object.keys(images);
const failures = [];

for (let index = 0; index < names.length; index += 4) {
  await Promise.all(names.slice(index, index + 4).map(async (name) => {
    if (!images[name]) { failures.push(`${name}: not in prompts.json`); return; }
    try {
      const original = `${originalsDir}${name}.png`;
      if (!exportOnly && (requested.length || !existsSync(original))) {
        const image = await generate(name, images[name]);
        console.log(`generated ${name} ${image.width}x${image.height}`);
      }
      if (!existsSync(original)) { failures.push(`${name}: no original`); return; }
      const brightness = meanBrightness(original);
      if (brightness < 0.03) { failures.push(`${name}: looks blank (mean ${brightness.toFixed(3)})`); return; }
      exportWebp(name);
    } catch (error) {
      failures.push(error.message);
    }
  }));
}

if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`done: ${names.length} image(s) exported to static/fire-and-mountain/today/img/`);
