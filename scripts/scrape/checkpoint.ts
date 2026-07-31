/** Tiny JSON-file checkpoint so long scrapes are resumable after an interruption. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

const dir = join("scripts", "scrape");
const file = (name: string) => join(dir, `.checkpoint-${name}.json`);

export async function loadCheckpoint(name: string): Promise<{ next: number }> {
  const f = file(name);
  if (!existsSync(f)) return { next: 1 };
  try {
    return JSON.parse(await readFile(f, "utf8"));
  } catch {
    return { next: 1 };
  }
}

export async function saveCheckpoint(name: string, next: number): Promise<void> {
  const f = file(name);
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify({ next, at: new Date().toISOString() }), "utf8");
}
