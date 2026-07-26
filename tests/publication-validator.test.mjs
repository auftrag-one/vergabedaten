import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const VALIDATOR_PATH = new URL(
  "../scripts/validate-publications.mjs",
  import.meta.url,
);

function validManifest() {
  return {
    schemaVersion: 1,
    publicationId: "2026-07",
    title: "Vergabemarkt Juli 2026",
    publishedAt: "2026-07-31",
    license: "CC-BY-4.0",
    licensor: "Debevet UG (haftungsbeschränkt)",
    attribution: {
      name: "Auftrag One",
      url: "https://auftragone.com",
    },
    sources: [
      {
        name: "TED",
        url: "https://ted.europa.eu/",
        retrievedAt: "2026-07-26",
        reuseTermsUrl: "https://ted.europa.eu/de/legal-notice",
        rightsReviewed: true,
      },
    ],
    privacyReview: {
      completed: true,
      containsPersonalData: false,
      aggregateOnly: true,
      directIdentifiersRemoved: true,
      smallCellRiskReviewed: true,
    },
    files: ["market.csv"],
  };
}

async function createWorkspace(t) {
  const root = await mkdtemp(join(tmpdir(), "vergabedaten-publication-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function writePublication(root, manifest, files = [["market.csv", "month,count\n2026-07,12\n"]]) {
  const releaseDirectory = join(root, "data", manifest.publicationId);
  await mkdir(releaseDirectory, { recursive: true });
  await writeFile(
    join(releaseDirectory, "publication.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  await Promise.all(
    files.map(([name, contents]) =>
      writeFile(join(releaseDirectory, name), contents),
    ),
  );
}

function runValidator(root) {
  return spawnSync(process.execPath, [VALIDATOR_PATH.pathname, root], {
    encoding: "utf8",
  });
}

test("allows a repository with no data publications", async (t) => {
  const root = await createWorkspace(t);

  const result = runValidator(root);

  assert.equal(result.status, 0, result.stderr);
});

test("accepts a cleared aggregate publication", async (t) => {
  const root = await createWorkspace(t);
  await writePublication(root, validManifest());

  const result = runValidator(root);

  assert.equal(result.status, 0, result.stderr);
});

test("rejects a release directory without a publication manifest", async (t) => {
  const root = await createWorkspace(t);
  const releaseDirectory = join(root, "data", "2026-07");
  await mkdir(releaseDirectory, { recursive: true });
  await writeFile(join(releaseDirectory, "market.csv"), "month,count\n2026-07,12\n");

  const result = runValidator(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing publication\.json/);
});

test("rejects a publication without source provenance", async (t) => {
  const root = await createWorkspace(t);
  const manifest = validManifest();
  manifest.sources = [];
  await writePublication(root, manifest);

  const result = runValidator(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /at least one source is required/);
});

test("rejects a publication whose source rights were not reviewed", async (t) => {
  const root = await createWorkspace(t);
  const manifest = validManifest();
  manifest.sources[0].rightsReviewed = false;
  await writePublication(root, manifest);

  const result = runValidator(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /source 1 rightsReviewed must be true/);
});

test("rejects a publication marked as containing personal data", async (t) => {
  const root = await createWorkspace(t);
  const manifest = validManifest();
  manifest.privacyReview.containsPersonalData = true;
  await writePublication(root, manifest);

  const result = runValidator(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /containsPersonalData must be false/);
});

test("rejects a data file that is missing from the publication manifest", async (t) => {
  const root = await createWorkspace(t);
  await writePublication(root, validManifest(), [
    ["market.csv", "month,count\n2026-07,12\n"],
    ["unreviewed.csv", "month,count\n2026-07,2\n"],
  ]);

  const result = runValidator(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unlisted data file: unreviewed\.csv/);
});

test("rejects direct-identifier fields even after a completed privacy review", async (t) => {
  const root = await createWorkspace(t);
  await writePublication(
    root,
    validManifest(),
    [["market.csv", "month,email,count\n2026-07,person@example.com,1\n"]],
  );

  const result = runValidator(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /forbidden field: email/);
});
