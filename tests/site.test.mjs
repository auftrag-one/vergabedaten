import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const INDEX_PATH = new URL("../index.html", import.meta.url);
const DATA_LICENSE_PATH = new URL("../DATA-LICENSE.md", import.meta.url);
const IMPRINT_PATH = new URL("../impressum.html", import.meta.url);
const PRIVACY_PATH = new URL("../datenschutz.html", import.meta.url);

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

test("links directly to the legal notice and privacy information", async () => {
  const html = await pageHtml();

  assert.match(html, /<a[^>]+href="\.\/impressum\.html"[^>]*>Impressum<\/a>/);
  assert.match(
    html,
    /<a[^>]+href="\.\/datenschutz\.html"[^>]*>Datenschutz<\/a>/,
  );
});

test("identifies the service provider and editorially responsible person", async () => {
  const imprint = await readFile(IMPRINT_PATH, "utf8");

  assert.match(imprint, /Debevet UG \(haftungsbeschränkt\)/);
  assert.match(imprint, /Lauterstraße 12/);
  assert.match(imprint, /HRB 229531 B/);
  assert.match(imprint, /Verantwortlich[^<]*§ 18 Abs\. 2 MStV/i);
  assert.match(imprint, /Andreas Kraft/);
});

test("explains GitHub Pages hosting and visitor privacy rights", async () => {
  const privacy = await readFile(PRIVACY_PATH, "utf8");

  assert.match(privacy, /GitHub Pages/);
  assert.match(privacy, /IP-Adresse/i);
  assert.match(privacy, /Art\. 6 Abs\. 1 lit\. f DSGVO/i);
  assert.match(privacy, /Drittland|USA/i);
  assert.match(
    privacy,
    /https:\/\/docs\.github\.com\/en\/site-policy\/privacy-policies\/github-general-privacy-statement/,
  );
  assert.match(privacy, /Auskunft|Berichtigung|Löschung/);
});

test("names the legal entity that grants the data licence", async () => {
  const notice = await readFile(DATA_LICENSE_PATH, "utf8");

  assert.match(notice, /Debevet UG \(haftungsbeschränkt\)/);
  assert.match(notice, /operating under the brand Auftrag One/i);
  assert.match(notice, /Licensor means Debevet UG/i);
});
