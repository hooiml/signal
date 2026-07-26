# Primary-Document Evidence Contract

## Purpose

Signal lets a user retain a small exact excerpt from a primary filing or issuer announcement with enough source metadata to revisit it. The feature is a citation workspace, not full-document storage, semantic diffing, automatic interpretation, or a claim that issuer intent changed.

## Persisted contract

Document evidence is version 1 and is stored inside the existing `accepted_evidence` JSONB value as part of a version-2 evidence bundle. No database column is added. Legacy array-shaped accepted evidence remains readable and migrates to an empty valid document citation list.

Each research record and immutable review snapshot has:

```text
documentEvidence:
  version: 1
  migrationState: current | migrated-empty | invalid-recovered
  citations: ResearchDocumentCitation[0..25]
```

Each citation has fixed validated fields:

- stable ID, owning `market` and `symbol`;
- source kind: `10-K`, `10-Q`, `8-K`, `annual-report`, `interim-quarterly-report`, `exchange-announcement`, `earnings-release`, or `other-primary`;
- publication date and optional reporting period;
- title, canonical credential-free HTTPS URL, fixed provider/issuer label, and bounded section/page/location;
- exact user-selected excerpt, capped at 2,000 characters;
- captured timestamp, capture method (`sec-official` or `manual-unverified`), and deterministic content fingerprint.

The fingerprint detects a changed capture. It is not a cryptographic authenticity or document-integrity claim. The UI renders excerpts as React text only and never interprets embedded HTML or Markdown.

Malformed persisted citation sets recover to an empty list with `invalid-recovered` status so the rest of the research record remains available. Incoming malformed updates are rejected. IDs must be unique and every citation must match the owning record's market and symbol.

## Save and revision behavior

Citation add, edit, and confirmed removal remain local draft changes until `Save citations`. The request uses `mode: evidence`, the existing optimistic `revision`, and a server-side allowlist that applies only `documentEvidence`. It cannot mutate thesis text, checklist, accepted provider evidence, monitoring rules, decision journal, position plan, or review history.

A later explicit full review freezes the current citation set in the immutable review snapshot. Comparison uses stable citation identity and content fingerprint against the preceding immutable review:

- `added`: stable ID exists only in the current set;
- `changed`: stable ID exists in both sets but the captured content fingerprint differs;
- `removed`: stable ID exists only in the baseline;
- `unchanged`: stable ID and fingerprint are equal.

If the latest snapshot already equals the current set, the comparison uses the next older snapshot. Otherwise it compares the current evidence-only draft/save with the latest snapshot. A changed excerpt means the captured evidence changed; Signal does not infer materiality or management intent.

## Official SEC discovery

`GET /api/research/filings/[symbol]` accepts only a bounded validated US symbol. It:

1. resolves the CIK through `https://www.sec.gov/files/company_tickers.json`;
2. loads recent submissions only from `https://data.sec.gov/submissions/CIK##########.json`;
3. retains at most ten recent `10-K`, `10-Q`, `8-K`, `20-F`, or `6-K` entries;
4. constructs the filing link deterministically under `https://www.sec.gov/Archives/edgar/data/...`.

Requests reject redirects, use an eight-second timeout, validate upstream structure, and run through a six-hour server cache. Browser-supplied upstream URLs are never accepted. The server does not fetch the filing document or follow its links.

`SEC_USER_AGENT` must identify the operator and include a contact email or HTTP(S) contact URL. Missing or invalid configuration fails closed and returns a recoverable degraded state; no contact value is invented.

## Malaysia and manual capture

Signal does not claim automated Bursa historical coverage. For Bursa or issuer documents, the user opens and verifies the primary HTTPS source independently, then supplies bounded metadata and an excerpt. Signal validates and stores the canonical HTTPS link but never fetches it server-side. Manual captures remain visibly labelled `manual-unverified`.

Users should verify the issuer, announcement date, reporting period, and source domain against Bursa Malaysia or the issuer's official investor-relations site before relying on a capture.

## Privacy and copyright boundaries

- Store only the selected excerpt, never a PDF, filing body, or full announcement.
- Do not proxy, download, redistribute, scrape, summarize, or semantically interpret primary documents.
- Do not put symbols, URLs, titles, locations, excerpts, digests, or document content in product analytics.
- Queue handoff stores only its existing bounded ticker/template/source/dedupe contract; it never rewrites thesis text.

## Intentionally unsupported

- arbitrary server-side URL retrieval or redirect following;
- full-document storage, search, semantic diffing, AI summaries, or management-intent claims;
- automated Bursa historical discovery;
- PDF extraction, OCR, transcript ingestion, credentials, or document redistribution;
- automatic thesis/checklist/decision updates.
