# Competition Results — Design Notes (In Progress)

> **Status: Paused — not yet approved. Resume brainstorming before writing an implementation plan.**

---

## What We're Building

Auto-fetch competition results from Scorebase and link them to gymnasts in the app. This is separate from the existing Competition model (which is just taxonomy — linking levels to competition types).

---

## Scorebase API

Scorebase (`scorebase.co.uk`) is a JS-rendered SPA with no public API, but the frontend calls an undocumented REST API. The API requires an `x-api-key` header generated at request time:

```js
// From the minified JS bundle (index-6d4c06a5.js)
const secret = 'y$G3G(+*[!ehQK`ln<%=h0+x_&lWVb';
const payload = JSON.stringify({ ts: Date.now() });
const apiKey = CryptoJS.AES.encrypt(payload, secret).toString();
// Pass as: headers: { 'x-api-key': apiKey }
```

This is fragile (JS bundle could change), but accepted as a known trade-off.

### Useful endpoints (all require `x-api-key` header)

| Endpoint | Description |
|---|---|
| `GET /api/fetchEventInfo?db=British2025` | Event name, location, date |
| `GET /api/fetchCategories?db=British2025` | All categories with `CatId`, discipline, category name |
| `GET /api/fetchOnlineResults?db=British2025&catId=D10&compType=0` | Full results for one category |
| `GET /api/fetchSearchResults?db=British2025&searchTerm=Apollo%20Trampoline%20Club` | All results for a club across all disciplines in one call |

**The key endpoint is `fetchSearchResults` by club name** — one call per club per event returns all gymnasts' results across all disciplines.

### Result shape (key fields)

```json
{
  "CompetitorId": 158,
  "FirstName1": "Jake",
  "Surname1": "Westgarth",
  "Club": "Apollo Trampoline Club",
  "CatId": "D10",
  "TotalScore": "82.60",
  "CumulativeRank": 1,
  "Discipline": "DMT",
  "Category": { "Category": "Senior Men", "Discipline": "DMT", ... },
  "RoundTotals": [ { "Round": "Q2", "RoundTotal": "27.50", "RoundRank": 3 }, ... ],
  "Exercises": [ { "Execution": "18.30", "Difficulty": "9.2", "Total": "27.50", ... } ]
}
```

### Searching by gymnast name

`fetchSearchResults` also accepts a gymnast name directly (not just club name):

```
GET /api/fetchSearchResults?db=British2025&searchTerm=Jake%20Westgarth
```

Returns all results for that competitor across all disciplines. Works for paired TRS competitors too — searching either name returns the pair (e.g. searching "Tristan Scott" returns "Hector Shipley / Tristan Scott").

### Videos

Each exercise in the result has a `Videos` array. Videos are served from a public Cloudflare CDN — no auth required:

```
https://cdn.scorebase.co.uk/{db}/{Variant}/{Filename}
```

Example:
```
https://cdn.scorebase.co.uk/British2025/HQ/Trampoline Tumbling and DMT British Championships - DMT - Senior Men - WESTGARTH Jake - Apollo Trampoline Club - Exercise 1 - Angle 1 (158).mp4
```

- `Variant`: `HQ` or `LQ`
- `Filename`: taken directly from `Videos[].Filename` in the result JSON
- Videos can be linked to or inlined with a `<video>` tag

### Event discovery

There is no "list all events" API endpoint. Event `db` codes must be manually entered by admin. Known codes: `British2025`, `NAGF2025`. The `db` value is the event's `EventShortName` on Scorebase.

---

## Gymdata (English Series)

Gymdata (`gymdata.co.uk`) is a traditional server-rendered ASP.NET site with **no JSON API**. Results are published as PDF downloads only.

### Document list endpoint

```
GET https://www.gymdata.co.uk/events/download-documents.aspx?eid={eventId}
```

Returns an HTML page listing all downloadable documents for the event. Result PDFs are identifiable by filename (e.g. "All DMT Results.pdf", "All TRI Results.pdf", "All TRS Results.pdf"). Document IDs can be scraped from `DocumentID=` occurrences in the HTML (each ID appears 3 times; de-duplicate to get ordered list).

### PDF download endpoint

```
GET https://www.gymdata.co.uk/Download.ashx?ProcessType=document&EventID={eid}&DocumentID={did}
```

Returns the PDF directly (`Content-Type: application/pdf`). No auth required.

### PDF structure

Each PDF covers one discipline across all categories. Text extraction with `pdfplumber` works cleanly. Example result rows:

```
357 Troy Holliday Liverpool DMT Silver 9-10 Male 38.900 5 =
357 Troy Holliday Liverpool DMT Silver 9-10 Male Final 1 3 1.700 8 6 20 16.600 18.300 18.300 7
```

Format: `{entryNo} {Name} {Club} {Category} {TotalScore} {Rank}`
Final rows add: `{round} {exerciseNo} {diff} {deductions...} {total} {rank}`

### Fetch approach

1. Fetch the document list page for the event ID
2. Scrape DocumentIDs and filenames — pick all files containing "Results"
3. Download each results PDF
4. Extract all text, search for gymnast name
5. Parse surrounding lines for rank and score

This finds a gymnast across all disciplines and categories in one pass — no need to know which category they competed in.

### Known event IDs

| Event | EventID |
|---|---|
| 2025 EG TRA+DMT Championships | 2565 |

Event IDs must be manually configured (no list endpoint found).

### No videos

Gymdata PDFs contain no video links.

---

## Competition Series

There are four competition series, each with their own data source:

| Series | Platform | Method |
|---|---|---|
| British | Scorebase | JSON API (`fetchSearchResults` by name) |
| English | Gymdata | PDF download + text parse |
| League | TBD | TBD |
| Regional | TBD | TBD |

Scoring structures differ significantly between series. The solution is to store raw data (JSON or parsed text) + a small set of normalised fields rather than a per-series schema.

---

## Proposed Design

### Data model

- **`CompetitionSeries`** — "British", "English", "League", "Regional"; name + description
- **`CompetitionEvent`** — belongs to a series; source-specific identifier (Scorebase `dbCode` or Gymdata `eventId`), event name, date, location, `lastFetchedAt`
- **`CompetitionResult`** — belongs to event + gymnast (nullable for unmatched); `discipline`, `category`, `rank`, `totalScore`, `scorebaseCompetitorId`, `rawData` (JSON blob), `matchStatus` (MATCHED / UNMATCHED / IGNORED)
- **`Gymnast.scorebaseClubName`** — the gymnast's registered club name on Scorebase (may differ from the app's club name)

### Fetch flow

1. Admin adds an event (`db` code + series). System calls `fetchEventInfo` to populate name/date/location.
2. Admin triggers "Fetch results" for an event.
3. System collects unique `scorebaseClubName` values across all gymnasts in the club.
4. Calls `fetchSearchResults?db=X&searchTerm=ClubName` once per unique club name.
5. Matches each result to a gymnast by `firstName + lastName + scorebaseClubName` (case-insensitive).
6. Stores each result with MATCHED or UNMATCHED status.
7. Admin reviews unmatched results — manually links to gymnast or marks IGNORED.
8. `scorebaseCompetitorId` stored on the result (and potentially on gymnast) for future matching reliability.

### Why multiple clubs?

The admin coaches gymnasts from multiple clubs. Each gymnast stores their own `scorebaseClubName` so the fetch covers all clubs represented.

### UI (outline, not finalised)

- Admin: manage series and events, trigger fetches per event, review unmatched results
- Gymnast profile: competition history tab showing results across all events/series
- Possibly a club-wide results view per event

---

## Open Questions

- League and Regional data sources not yet investigated
- Exact scoring field differences between series — to be explored when resuming
- Whether to store `scorebaseCompetitorId` on the `Gymnast` record directly (for future matching) or only on `CompetitionResult`
- UI detail not yet designed

---

## What Still Needs to Happen

1. Resume brainstorming — present design to user, get approval
2. Write full spec and get user sign-off
3. Write implementation plan
