// scan-guide-links.mjs
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const DIRS = ["app", "components", "lib"];
const hits = new Map(); // slug -> Set of files

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full);
      continue;
    }
    if (!/\.(tsx?|ts)$/.test(entry)) continue;

    const rel = relative(ROOT, full).replace(/\\/g, "/");
    // Skip the guides section itself — we only want links from OUTSIDE it.
    if (rel.startsWith("app/guides/")) continue;

    const text = readFileSync(full, "utf8");
    for (const m of text.matchAll(/\/guides\/([a-z0-9-]+)/g)) {
      if (!hits.has(m[1])) hits.set(m[1], new Set());
      hits.get(m[1]).add(rel);
    }
  }
}

for (const d of DIRS) {
  try { walk(join(ROOT, d)); } catch { console.log(`(skipped missing dir: ${d})`); }
}

const sorted = [...hits.entries()].sort((a, b) => b[1].size - a[1].size);

if (sorted.length === 0) {
  console.log("No inbound links to any guide found outside app/guides/.");
} else {
  for (const [slug, files] of sorted) {
    console.log(`${String(files.size).padEnd(3)} ${slug}`);
    for (const f of files) console.log(`      ${f}`);
  }
}
console.log(`\n--- ${sorted.length} guides have inbound links ---`);