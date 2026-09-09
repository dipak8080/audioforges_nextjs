/**
 * Notifies IndexNow (Bing, Yandex, Seznam and others) that URLs have changed.
 *
 * Usage:
 *   node scripts/indexnow.mjs                    submits every URL in the sitemap
 *   node scripts/indexnow.mjs /guides/new-guide  submits specific paths
 */

const KEY = "9ff12e8df2af4e72b9d4eb1fafdd30c7";
const HOST = "www.audioforges.com";
const ORIGIN = `https://${HOST}`;

async function urlsFromSitemap() {
  const res = await fetch(`${ORIGIN}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function main() {
  const args = process.argv.slice(2);

  const urlList = args.length
    ? args.map((p) => (p.startsWith("http") ? p : `${ORIGIN}${p.startsWith("/") ? p : `/${p}`}`))
    : await urlsFromSitemap();

  if (!urlList.length) {
    console.error("No URLs to submit.");
    process.exit(1);
  }

  const batches = [];
  for (let i = 0; i < urlList.length; i += 10000) {
    batches.push(urlList.slice(i, i + 10000));
  }

  for (const batch of batches) {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `${ORIGIN}/${KEY}.txt`,
        urlList: batch,
      }),
    });

    if (res.status === 200 || res.status === 202) {
      console.log(`Submitted ${batch.length} URLs (HTTP ${res.status})`);
    } else {
      console.error(`IndexNow rejected the batch: HTTP ${res.status} ${await res.text()}`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});