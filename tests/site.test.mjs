import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const INDEX_PATH = new URL("../index.html", import.meta.url);
const DATA_LICENSE_PATH = new URL("../DATA-LICENSE.md", import.meta.url);

async function pageHtml() {
  return readFile(INDEX_PATH, "utf8");
}

test("publishes an indexable German data page with a direct Auftrag One backlink", async () => {
  const html = await pageHtml();

  assert.match(html, /<html[^>]+lang="de"/);
  assert.match(html, /<title>[^<]*Vergabedaten[^<]*<\/title>/);
  assert.match(
    html,
    /<link[^>]+rel="canonical"[^>]+href="https:\/\/auftrag-one\.github\.io\/vergabedaten\/"/,
  );
  assert.match(
    html,
    /<a[^>]+href="https:\/\/auftragone\.com"[^>]*>[\s\S]*?Auftrag One[\s\S]*?<\/a>/,
  );
  assert.match(html, /<link[^>]+rel="icon"[^>]+href="data:,"/);
});

test("limits CC BY 4.0 to marked data publications and reserves product rights", async () => {
  const html = await pageHtml();

  assert.match(html, /data-license="CC-BY-4\.0"/);
  assert.match(
    html,
    /gilt ausschließlich für ausdrücklich gekennzeichnete\s+Datensätze/i,
  );
  assert.match(
    html,
    /Produkt, Software, Website, Namen, Logo und\s+Marken/i,
  );
  assert.match(html, /Source: Auftrag One/);
  assert.match(html, /https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
});

test("shows an honest preparation state without a fake dataset download", async () => {
  const html = await pageHtml();

  assert.match(html, /data-release-status="preparing"/);
  assert.match(html, /Erste Veröffentlichung in Vorbereitung/i);
  assert.doesNotMatch(html, /href="(?:\.\/|\/)?data\//);
});

test("provides the static page landmarks needed for keyboard and mobile use", async () => {
  const html = await pageHtml();

  assert.match(html, /<meta[^>]+name="viewport"/);
  assert.match(html, /<a[^>]+class="skip-link"[^>]+href="#main-content"/);
  assert.match(html, /<nav[^>]+aria-label="Hauptnavigation"/);
  assert.match(html, /<main[^>]+id="main-content"/);
  assert.match(html, /<section[^>]+id="daten"/);
  assert.match(html, /<footer/);
});

test("warns readers to verify official sources instead of treating aggregates as advice", async () => {
  const html = await pageHtml();

  assert.match(
    html,
    /keine Rechts-, Vergabe- oder\s+Geschäftsberatung/i,
  );
  assert.match(html, /kein amtliches Vergaberegister/i);
  assert.match(html, /Originalbekanntmachung/i);
  assert.match(html, /zuständigen Vergabestelle/i);
});

test("keeps the data warranty disclaimer within mandatory law", async () => {
  const notice = await readFile(DATA_LICENSE_PATH, "utf8");

  assert.match(notice, /as-is and\s+as-available/i);
  assert.match(notice, /to the extent permitted by applicable law/i);
  assert.match(notice, /mandatory liability remains unaffected/i);
  assert.match(notice, /not\s+legal, procurement, or business advice/i);
});
