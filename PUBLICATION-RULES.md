# Publication gate

Real datasets belong in `data/<publication-id>/`. Every publication directory
must contain a `publication.json` manifest and only the files named by that
manifest.

The manifest records:

- the exact data license and legal licensor;
- every original source, retrieval date, reuse terms, and completed rights
  review;
- a completed privacy review confirming aggregate-only data, removal of direct
  identifiers, and review of small-cell risks; and
- the complete list of released CSV or JSON files.

The automated gate rejects releases without source provenance, affirmative
rights clearance, or the privacy confirmations. It also rejects unlisted files,
direct-identifier field names, and email addresses found in data files.

Use [`publication.example.json`](publication.example.json) as the starting
point. Replace every example value with the facts for the release, then run:

```sh
node scripts/validate-publications.mjs .
node --test
```

The automated scan is a minimum safeguard. A person must still verify source
terms, upstream attribution, aggregation quality, and privacy risk before
setting the review fields to `true`.
