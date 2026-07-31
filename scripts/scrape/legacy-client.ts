/**
 * READ-ONLY legacy HTTP client for intra.gastro.co.id.
 *
 * Hard rule: this client issues **GET only**. There is no post/put/delete method
 * and there never should be — the legacy system must not be mutated. Auth is by
 * reusing a logged-in session cookie (LEGACY_COOKIE) so we never even POST a login.
 *
 * Features: rate limiting, retry with backoff, raw-HTML archival, and detection
 * of the "bounced to /user_session/new" redirect that means the cookie is stale.
 */
import "../_env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import pLimit from "p-limit";

const BASE = (process.env.LEGACY_BASE_URL ?? "https://intra.gastro.co.id").replace(/\/$/, "");
const RAW_DIR = join("scripts", "scrape", "raw");

function cookie(): string {
  const c = process.env.LEGACY_COOKIE?.trim();
  if (!c) {
    throw new Error(
      "LEGACY_COOKIE kosong. Buka intra.gastro.co.id yang sudah login di Chrome, " +
        "DevTools → Application → Cookies, salin header cookie (mis. `_gastro_session=...`) ke .env.local.",
    );
  }
  return c;
}

export class StaleSessionError extends Error {
  constructor() {
    super("Legacy session invalid — halaman redirect ke /user_session/new. Perbarui LEGACY_COOKIE.");
    this.name = "StaleSessionError";
  }
}

const limit = pLimit(Number(process.env.SCRAPE_CONCURRENCY ?? 4));
const DELAY_MS = Number(process.env.SCRAPE_DELAY_MS ?? 150);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET a legacy path, returning HTML. Retries on 5xx/network; throws on stale session. */
export async function get(path: string, opts: { retries?: number } = {}): Promise<string> {
  const url = path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const retries = opts.retries ?? 3;
  return limit(async () => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            cookie: cookie(),
            "user-agent": "gastro-intranet-migrator/1.0 (read-only)",
            accept: "text/html,application/xhtml+xml",
          },
          redirect: "follow",
        });
        // Rails bounces unauthorized requests to the login form.
        if (res.url.includes("/user_session/new") || res.url.includes("/login")) {
          throw new StaleSessionError();
        }
        if (res.status >= 500) throw new Error(`HTTP ${res.status} for ${url}`);
        if (res.status === 404) return ""; // caller treats empty as "no record"
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
        await sleep(DELAY_MS);
        return await res.text();
      } catch (e) {
        if (e instanceof StaleSessionError) throw e;
        if (attempt === retries) throw e;
        await sleep(500 * (attempt + 1));
      }
    }
    return "";
  });
}

/** GET and also archive the raw HTML under scripts/scrape/raw/<key>.html for re-parsing. */
export async function getArchived(path: string, key: string): Promise<string> {
  const file = join(RAW_DIR, `${key}.html`);
  if (process.env.SCRAPE_USE_CACHE === "1" && existsSync(file)) {
    return readFile(file, "utf8");
  }
  const html = await get(path);
  if (html) {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html, "utf8");
  }
  return html;
}

export { BASE };
