# Competition Results — External Results Database Design

**Date:** 2026-05-02

## Goal

Build a public, searchable database of trampoline / synchro / DMT competition
results across many years. Data lands exclusively via per-source importer
plugins (no manual entry). The dataset spans the wider gymnastics scene, not
just this club's gymnasts — so it lives on a separate `Athlete` model that
optionally cross-references the existing `Gymnast` table when an athlete is
also one of the club's own.

## Decisions captured from brainstorm

- **Scope:** external competitions only. Internal hosted events keep using the
  existing `CompetitionEvent` model and are not in this feature.
- **Disciplines:** Trampoline (TRA), Synchro (SYN), DMT. Tumbling explicitly
  out of scope.
- **Score detail:** per-round breakdown with `E / D / T / H / S / penalty /
  total` columns; all nullable so historical / partial data imports cleanly.
- **Synchro:** two `CompetitionResult` rows linked by a shared `pairId`.
- **Lookup views:** three tabs sharing the same data — gymnast-first,
  competition-first, year-first. Gymnast tab is the default.
- **Entry path:** import-only. No UI to type a result row from scratch. If a
  competition has no fetchable source, it isn't tracked.
- **Athlete model:** new table, separate from `Gymnast`. Optional
  `Athlete.gymnastId` links an external-competition athlete to a club's own
  gymnast record so progress tracking continues to work internally.
- **Public access:** unauthenticated read endpoints; admin auth still required
  for import / edit. Public pages mounted under `/results/*` on the existing
  app domain. A `results.<domain>` subdomain alias is a low-effort follow-up
  if SEO / branding warrants it.
- **Privacy:** only republish what the source already publishes. `DOB` is
  internal-only (used for athlete dedupe at import time, never exposed to
  unauthenticated callers).
- **Curation:** this club's admins are the editors of record for the whole
  dataset in v1. Per-club curation (inviting other clubs' admins to verify
  their own athletes) is deferred.
- **Video:** optional `videoUrl` per result and per round.

## Schema

Six new models. No changes to existing models — `Gymnast` is read-only from
this feature.

```prisma
model ExternalCompetition {
  id            String   @id @default(cuid())
  name          String
  location      String?
  date          DateTime
  endDate       DateTime?
  discipline    String   // 'TRA' | 'SYN' | 'DMT'
  source        String   // matches the importer plugin name
  sourceUrl     String   // canonical URL for re-imports
  externalId    String?  // source-assigned identifier where available
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  results       CompetitionResult[]

  @@unique([source, externalId])
  @@index([date])
  @@index([discipline])
  @@map("external_competitions")
}

model Athlete {
  id           String  @id @default(cuid())
  firstName    String
  lastName     String
  club         String?
  // DOB used for fuzzy-matching at import; not exposed to public endpoints.
  dateOfBirth  DateTime?
  verified     Boolean @default(false)  // admin-blessed canonical record
  // Cross-reference: when this athlete IS one of our club's gymnasts.
  gymnastId    String?
  gymnast      Gymnast? @relation(fields: [gymnastId], references: [id])
  // Source attribution for dedupe / re-imports.
  source       String?
  externalId   String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  results      CompetitionResult[]

  @@index([lastName, firstName])
  @@index([gymnastId])
  @@map("athletes")
}

model CompetitionResult {
  id                       String  @id @default(cuid())
  externalCompetitionId    String
  athleteId                String?              // null while in 'needs review'
  category                 String               // copied verbatim from source
  finalPlacement           Int?
  totalScore               Decimal? @db.Decimal(7, 3)
  qualified                Boolean?
  notes                    String?
  videoUrl                 String?
  pairId                   String?              // synchro: links two rows
  source                   String
  externalId               String?              // dedupe key with source
  importedAt               DateTime @default(now())
  lastSeenAt               DateTime @default(now())
  externalCompetition      ExternalCompetition @relation(fields: [externalCompetitionId], references: [id], onDelete: Cascade)
  athlete                  Athlete? @relation(fields: [athleteId], references: [id])
  rounds                   CompetitionResultRound[]

  @@unique([source, externalId])
  @@index([externalCompetitionId])
  @@index([athleteId])
  @@index([pairId])
  @@map("competition_results")
}

model CompetitionResultRound {
  id           String  @id @default(cuid())
  resultId     String
  roundType    String  // 'compulsory' | 'voluntary' | 'final' | 'pass1' | 'pass2' | 'freeform'
  order        Int
  // All score components nullable — historical sources are patchy.
  E            Decimal? @db.Decimal(6, 3)
  D            Decimal? @db.Decimal(5, 3)
  T            Decimal? @db.Decimal(6, 3)
  H            Decimal? @db.Decimal(5, 3)
  S            Decimal? @db.Decimal(6, 3)   // synchro
  penalty      Decimal? @db.Decimal(5, 3)
  total        Decimal? @db.Decimal(7, 3)
  videoUrl     String?
  result       CompetitionResult @relation(fields: [resultId], references: [id], onDelete: Cascade)

  @@index([resultId])
  @@map("competition_result_rounds")
}

// Manual flag for "these two athlete rows might be the same person — review".
model AthleteMergeCandidate {
  id            String   @id @default(cuid())
  athleteAId    String
  athleteBId    String
  similarity    Decimal  @db.Decimal(4, 3)
  resolved      Boolean  @default(false)
  resolution    String?  // 'merged' | 'rejected'
  createdAt     DateTime @default(now())

  @@unique([athleteAId, athleteBId])
  @@map("athlete_merge_candidates")
}
```

## Importer framework

```
backend/services/competitionImporters/
  index.js            // registry + dispatcher + fuzzy-match utilities
  britishGymnastics.js
  …                   // one file per source, added incrementally
```

Each plugin module exports:

```js
{
  name: 'British Gymnastics',
  matchUrl: (url) => boolean,
  fetch: async (url) => rawData,         // HTTP / JSON / HTML
  parse: (rawData, url) => ({
    competition: { name, location, date, endDate?, discipline, sourceUrl, externalId? },
    results: [{
      athleteMatcher: { firstName, lastName, club?, dob? },
      category, finalPlacement?, totalScore?, qualified?,
      pairKey?,            // string, used to link synchro pairs in this batch
      videoUrl?,
      externalId?,
      rounds: [{ roundType, order, E?, D?, T?, H?, S?, penalty?, total?, videoUrl? }],
    }],
  }),
}
```

The dispatcher (`POST /api/competition-results/import`, admin-only) takes
`{ url, dryRun? }`. It:

1. Picks the matching plugin via `matchUrl`. Returns 400 if none match.
2. Calls `fetch` and `parse`.
3. Upserts the `ExternalCompetition` keyed on `(source, externalId)` if
   `externalId` is set, else `(source, sourceUrl)`.
4. For each result row, fuzzy-matches `athleteMatcher` against existing
   `Athlete` rows: exact name + same club is auto-link; close match (>0.85
   similarity) creates an `AthleteMergeCandidate` for review; no match creates
   a new `Athlete` row with `verified = false`.
5. Upserts the `CompetitionResult` keyed on `(source, externalId)`. Re-imports
   refresh the row in place and bump `lastSeenAt`.
6. Synchro: `pairKey` strings emitted by the parser are reconciled to a
   shared `pairId` for the two athletes' rows.
7. `dryRun: true` returns the parsed shape without writing — used by the
   import preview UI.

When you bring a new source we sit down (in a separate session), inspect the
URL together, and write a new plugin module. Each source is its own
brainstorm + spec + commit cycle; the framework here just defines the shape.

## API surface

### Public (unauthenticated)

- `GET /public/competitions` — list, paginated; filters: year, discipline.
- `GET /public/competitions/:id` — competition + grouped results by category.
- `GET /public/athletes/:id` — athlete profile + their results, sorted by
  date desc. DOB never returned.
- `GET /public/athletes?q=…` — typeahead by name; returns id, name, club only.
- `GET /public/results?year=…&discipline=…&competitionId=…&athleteId=…` —
  paginated combined feed for the year-first tab.

All public endpoints set conservative cache headers and rate-limit by IP.

### Admin (auth required, club-admin scope)

- `POST /api/competition-results/import` — `{ url, dryRun? }`, runs a plugin.
- `GET /api/competition-results/review` — needs-review queues:
  unmatched-athlete results, unverified athletes, merge candidates.
- `POST /api/competition-results/athletes/:id/verify` — flip `verified` true.
- `POST /api/competition-results/athletes/merge` — `{ keeperId, mergeIds[] }`,
  repoints results then deletes the merged rows.
- `PUT /api/competition-results/results/:id` — edit a result row (placement,
  total, athlete link, video URL, etc.).
- `PUT /api/competition-results/competitions/:id` — edit competition metadata.
- `DELETE /api/competition-results/results/:id` and competitions — full hard
  delete (admin discretion).

## Frontend

### Public site

A new top-level frontend route tree at `/results/*` (mounted under the same
React app, separate header/skin to distinguish from the club portal). Three
tabs share the same data:

- **Athlete tab (default):** typeahead picker → results table sorted by date.
  Above the table, a small line chart of `totalScore` over time (one series
  per discipline if the athlete has competed in more than one). Click a row
  to expand the round-by-round.
- **Competition tab:** year selector → list of competitions on that date
  range. Click → category-grouped results table.
- **Year tab:** year + discipline filter → combined results, sortable by
  date / placement / total.

Mounted at `/results/*` on the existing frontend, with a distinct skin
(different header colour, no Trampoline-Life-only navigation chrome) so
public visitors aren't confused into thinking this is a club login portal.
Crawlable — `robots.txt` allows indexing under `/results/*`, sitemap
generated nightly.

### Admin section

A new page in the existing admin hub: **Competition Results**. Three
sub-views:

- **Import** — paste URL, see parsed preview, confirm to commit.
- **Review** — three queues (unmatched results, unverified athletes, merge
  candidates). Two-click resolution per row.
- **Browse / edit** — same three lookup tabs as public, plus per-row edit
  pencils and admin-only fields.

## Verification

- Unit tests on the parser of every plugin we add (snapshot the raw fixture →
  assert the parsed shape).
- Integration test: dispatcher routes correctly by URL, dryRun returns the
  parsed shape without writing, real import upserts and links synchro pairs.
- Manual smoke: import a real URL end-to-end, verify the public pages render
  and the round breakdown displays.
- Privacy assertion test: hit every `/public/*` endpoint and assert no
  response body contains a `dateOfBirth` field.

## Out of scope (deferred to follow-ups)

- Per-club curation (inviting other clubs' admins to verify their own
  athletes). v1 is single-curator.
- Heat sheets / start lists for live competitions. This database is
  results-only.
- Tumbling discipline.
- Internal hosted events (`CompetitionEvent`) feeding into this database —
  separate scope.
- Manual entry UI. Explicitly excluded per brainstorm.
- Specific source plugins. Each new source is its own follow-up brainstorm.
- Athlete profile photos / bios — names + club only.
- Authentication for non-admin curators (e.g. club coaches verifying their
  own gymnasts' results).
