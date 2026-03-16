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

### Event discovery

There is no "list all events" API endpoint. Event `db` codes must be manually entered by admin. Known codes: `British2025`, `NAGF2025`. The `db` value is the event's `EventShortName` on Scorebase.

---

## Competition Series

There are four competition series, each with their own scoring representations:

- **British** — e.g., `British2025`
- **English**
- **League**
- **Regional**

Scoring structures are assumed to be significantly different between series. The solution is to store raw JSON + a small set of normalised fields rather than a per-series schema.

---

## Proposed Design

### Data model

- **`CompetitionSeries`** — "British", "English", "League", "Regional"; name + description
- **`CompetitionEvent`** — belongs to a series; `dbCode` (e.g. `British2025`), event name, date, location (fetched from Scorebase on creation), `lastFetchedAt`
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

- Exact scoring field differences between British / English / League / Regional — to be explored when resuming
- Whether to store `scorebaseCompetitorId` on the `Gymnast` record directly (for future matching) or only on `CompetitionResult`
- UI detail not yet designed

---

## What Still Needs to Happen

1. Resume brainstorming — present design to user, get approval
2. Write full spec and get user sign-off
3. Write implementation plan
