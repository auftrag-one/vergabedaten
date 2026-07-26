import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const DATA_DIRECTORY = "data";
const MANIFEST_FILE = "publication.json";
const EXPECTED_LICENSE = "CC-BY-4.0";
const EXPECTED_LICENSOR = "Debevet UG (haftungsbeschränkt)";
const EXPECTED_ATTRIBUTION_NAME = "Auftrag One";
const EXPECTED_ATTRIBUTION_URL = "https://auftragone.com";
const DATA_EXTENSIONS = new Set([".csv", ".json"]);
const FORBIDDEN_FIELDS = new Set([
  "address",
  "awardee",
  "contact",
  "contactname",
  "contactperson",
  "email",
  "firstname",
  "housenumber",
  "lastname",
  "person",
  "personname",
  "phone",
  "postalcode",
  "street",
  "supplier",
  "winner",
]);
const EMAIL_ADDRESS = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

function normalizeField(field) {
  return field.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function manifestFindings(manifest, releaseName) {
  const findings = [];

  if (manifest.publicationId !== releaseName) {
    findings.push(`publicationId must equal directory name ${releaseName}`);
  }
  if (manifest.license !== EXPECTED_LICENSE) {
    findings.push(`license must be ${EXPECTED_LICENSE}`);
  }
  if (manifest.licensor !== EXPECTED_LICENSOR) {
    findings.push(`licensor must be ${EXPECTED_LICENSOR}`);
  }
  if (manifest.attribution?.name !== EXPECTED_ATTRIBUTION_NAME) {
    findings.push(`attribution name must be ${EXPECTED_ATTRIBUTION_NAME}`);
  }
  if (manifest.attribution?.url !== EXPECTED_ATTRIBUTION_URL) {
    findings.push(`attribution URL must be ${EXPECTED_ATTRIBUTION_URL}`);
  }

  return findings;
}

function sourceFindings(sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    return ["at least one source is required"];
  }

  return sources.flatMap((source, index) => {
    const label = `source ${index + 1}`;
    const findings = [];
    const requiredText = ["name", "url", "retrievedAt", "reuseTermsUrl"];

    requiredText.forEach((field) => {
      if (typeof source?.[field] !== "string" || source[field].trim() === "") {
        findings.push(`${label} ${field} is required`);
      }
    });
    if (source?.rightsReviewed !== true) {
      findings.push(`${label} rightsReviewed must be true`);
    }

    return findings;
  });
}

function privacyFindings(review) {
  const requirements = [
    ["completed", true],
    ["containsPersonalData", false],
    ["aggregateOnly", true],
    ["directIdentifiersRemoved", true],
    ["smallCellRiskReviewed", true],
  ];

  return requirements.flatMap(([field, expected]) =>
    review?.[field] === expected
      ? []
      : [`privacyReview ${field} must be ${expected}`],
  );
}

function fileListFindings(files) {
  if (!Array.isArray(files) || files.length === 0) {
    return ["at least one data file is required"];
  }

  return files.flatMap((file) => {
    if (typeof file !== "string" || basename(file) !== file) {
      return [`invalid data file path: ${String(file)}`];
    }
    if (!DATA_EXTENSIONS.has(extname(file).toLowerCase())) {
      return [`unsupported data file: ${file}`];
    }
    return [];
  });
}

function fieldNames(fileName, contents) {
  if (extname(fileName).toLowerCase() === ".csv") {
    const header = contents.split(/\r?\n/, 1)[0] ?? "";
    return header.split(/[;,]/).map((field) => field.replaceAll('"', "").trim());
  }

  return [...contents.matchAll(/"([^"]+)"\s*:/g)].map((match) => match[1]);
}

function contentFindings(fileName, contents) {
  const forbiddenField = fieldNames(fileName, contents)
    .map((field) => [field, normalizeField(field)])
    .find(([, normalized]) => FORBIDDEN_FIELDS.has(normalized));
  const findings = forbiddenField
    ? [`${fileName}: forbidden field: ${forbiddenField[0]}`]
    : [];

  if (EMAIL_ADDRESS.test(contents)) {
    findings.push(`${fileName}: email address detected`);
  }

  return findings;
}

async function validateRelease(dataPath, releaseEntry) {
  const releaseName = releaseEntry.name;
  const releasePath = join(dataPath, releaseName);
  const manifestPath = join(releasePath, MANIFEST_FILE);
  let manifest;

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    const detail = error?.code === "ENOENT" ? `missing ${MANIFEST_FILE}` : error.message;
    return [`${releaseName}: ${detail}`];
  }

  const listedFiles = Array.isArray(manifest.files) ? manifest.files : [];
  const entries = await readdir(releasePath, { withFileTypes: true });
  const actualFiles = entries
    .filter((entry) => entry.isFile() && entry.name !== MANIFEST_FILE)
    .map((entry) => entry.name);
  const unlistedFindings = actualFiles
    .filter((file) => !listedFiles.includes(file))
    .map((file) => `unlisted data file: ${file}`);
  const missingFindings = listedFiles
    .filter((file) => !actualFiles.includes(file))
    .map((file) => `listed data file is missing: ${file}`);
  const contentChecks = await Promise.all(
    actualFiles.map(async (file) =>
      contentFindings(file, await readFile(join(releasePath, file), "utf8")),
    ),
  );

  return [
    ...manifestFindings(manifest, releaseName),
    ...sourceFindings(manifest.sources),
    ...privacyFindings(manifest.privacyReview),
    ...fileListFindings(manifest.files),
    ...unlistedFindings,
    ...missingFindings,
    ...contentChecks.flat(),
  ].map((finding) => `${releaseName}: ${finding}`);
}

async function validateRepository(rootPath) {
  const dataPath = join(rootPath, DATA_DIRECTORY);
  let entries;

  try {
    entries = await readdir(dataPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const misplaced = entries
    .filter((entry) => !entry.isDirectory())
    .map((entry) => `${entry.name}: data root may contain release directories only`);
  const releaseFindings = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => validateRelease(dataPath, entry)),
  );

  return [...misplaced, ...releaseFindings.flat()];
}

async function main() {
  const rootPath = process.argv[2] ?? process.cwd();
  const findings = await validateRepository(rootPath);

  if (findings.length === 0) {
    return;
  }

  process.stderr.write(
    `Publication validation failed:\n${findings.map((item) => `- ${item}`).join("\n")}\n`,
  );
  process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(`Publication validation failed: ${error.message}\n`);
  process.exitCode = 1;
});
