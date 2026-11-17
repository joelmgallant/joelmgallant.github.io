import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export function redact(url) {
  return String(url).replace(/api_key=[^&]+/g, "api_key=REDACTED");
}

const realSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFetcher({
  cacheDir, minIntervalMs, userAgent,
  fetchImpl = globalThis.fetch, sleep = realSleep, now = () => Date.now(), maxRetries = 4,
}) {
  let lastRequestAt = -Infinity;
  const stats = { network: 0, cached: 0 };

  async function readCache(file) {
    try {
      return { hit: true, data: JSON.parse(await readFile(file, "utf8")) };
    } catch (error) {
      if (error.code === "ENOENT") return { hit: false };
      throw error;
    }
  }

  async function getJson(url, { cacheKey = url } = {}) {
    const file = join(cacheDir, `${createHash("sha256").update(cacheKey).digest("hex")}.json`);
    const cached = await readCache(file);
    if (cached.hit) {
      stats.cached += 1;
      return cached.data;
    }
    for (let attempt = 0; ; attempt++) {
      const wait = lastRequestAt + minIntervalMs - now();
      if (wait > 0) await sleep(wait);
      lastRequestAt = now();
      const response = await fetchImpl(url, { headers: { "User-Agent": userAgent, Accept: "application/json" } });
      stats.network += 1;
      const retryable = response.status === 429 || response.status === 503;
      if (retryable && attempt < maxRetries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${redact(url)}`);
      const data = await response.json();
      await mkdir(cacheDir, { recursive: true });
      await writeFile(file, JSON.stringify(data));
      return data;
    }
  }

  return { getJson, stats };
}
