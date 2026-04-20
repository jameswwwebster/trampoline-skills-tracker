# Competition Category Age Brackets & Invite UI Design

## Overview

Competition categories currently have no age constraints, and the gymnast invite UI is a flat, unsearchable list. This spec covers adding optional age ranges to categories, filtering eligible gymnasts by calendar-year age, and improving the invite UI with a name search bar and age bracket tabs.

---

## Data Model

Add two optional integer fields to `CompetitionCategory`:

```prisma
model CompetitionCategory {
  id                 String   @id @default(cuid())
  competitionEventId String
  name               String
  minAge             Int?
  maxAge             Int?
  // existing relations unchanged
}
```

Both fields are nullable. A category with no `minAge`/`maxAge` accepts gymnasts of all ages. In practice, categories will always have at least `minAge` when age-restricted.

**Calendar-year age formula:** `competition_year - birth_year`, where `competition_year` is `new Date(event.startDate).getFullYear()`. A gymnast born 31/12/2015 is age 11 in 2026 regardless of their exact birthday.

**Migration:** A single Prisma migration adding the two nullable `Int` columns. No data migration required — existing categories remain valid with both fields null.

---

## Backend

### Category create/update APIs

Both the create (`POST /competition-events`) and update (`PUT /competition-events/:id`) endpoints accept `minAge` and `maxAge` in their Joi schemas and pass them through to Prisma. No other logic changes.

### Eligible endpoint (`GET /competition-events/:id/eligible`)

After the existing skill-level grouping, apply age filtering per category:

```js
const compYear = new Date(event.startDate).getFullYear();
gymnasts = gymnasts.filter(g => {
  if (!g.dateOfBirth) return true; // no DOB — not filtered out
  const age = compYear - new Date(g.dateOfBirth).getFullYear();
  if (category.minAge !== null && age < category.minAge) return false;
  if (category.maxAge !== null && age > category.maxAge) return false;
  return true;
});
```

Gymnasts without a `dateOfBirth` are never filtered out by age — they pass through and appear in the "All" tab in the UI.

The response shape is unchanged: `{ categoryId, categoryName, gymnasts: [...] }` — `minAge` and `maxAge` are added to the category object so the frontend can construct tab labels.

### All-gymnasts endpoint

Add `dateOfBirth` to the returned fields for future use. Age filtering itself happens server-side in the eligible endpoint.

---

## Admin Category UI

### Creation form (`AdminCompetitions.js`)

Add `minAge` and `maxAge` number inputs alongside the existing name field for each category. State shape becomes:

```js
{ name: '', minAge: '', maxAge: '', skillCompetitionIds: [] }
```

Empty string means no age constraint (sent as `null` to the API on save).

### Inline edit (`AdminCompetitionDetail.js`)

Add `minAge`/`maxAge` inputs to the existing inline edit form. The category list display shows the age range next to the category name: "Beginners · 11–13" or just "Beginners" if no range is set.

**Validation:** Both inputs are optional and numeric (`min={0}`). If both are provided, a frontend check ensures `maxAge >= minAge` before submit.

---

## Admin Invite UI

### Name search bar

A text input at the top of the invite panel. Filters the visible gymnast list client-side by first/last name (case-insensitive). No additional API calls.

### Age bracket tabs

Tabs derived from the competition's categories. Each category with a `minAge` becomes a tab labelled by its age range:

- Single bound: "11+" (minAge only) or "Under 14" (maxAge only — not used in practice)
- Both bounds: "11–13"
- Plus an "All" tab always present

Selecting a tab filters the gymnast list to only show gymnasts whose calendar-year age falls within that range. Gymnasts without a `dateOfBirth` appear under "All" only.

Tab data comes from the categories in the existing eligible endpoint response — no new API call.

### Filter composition

Both filters compose: selecting "11–13" and typing "Smith" shows only gymnasts aged 11–13 whose name contains "Smith".

The existing per-gymnast "Invite" button is unchanged.

---

## Out of Scope

- Enforcing that a gymnast can only be invited to age-appropriate categories (currently the admin can override)
- Displaying age brackets to gymnasts/guardians
- Age validation on entry checkout
