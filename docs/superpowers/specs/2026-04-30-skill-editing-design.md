# Skill Editing: Auto-Suggest, Master List, Mobile Search Design

**Date:** 2026-04-30

## Goal

Three connected improvements to the level/skill editing flow:

1. When adding or editing a skill, suggest difficulty and FIG notation automatically from structured inputs, using the FIG Trampoline Code of Points 2025–2028 (§17.1) rules.
2. Provide a single, complete list of all skills across all levels for review and audit of FIG notation and difficulty scores.
3. Make routine construction usable on mobile by replacing the dropdown with a search input that matches against name **or** FIG notation, with implicit-skill creation collapsed into the same input.

## Architecture

A pure JS calculator module is the source of truth for §17.1 maths. The Skill form is a single shared modal with structured inputs that drive the calculator. Skills gain a small set of structured columns so the calculator inputs round-trip on edit. A new `Skills` page provides the master table, reachable via a new tile on the admin hub. The routine-construction modal switches from `<select>` to a filtering search input.

## Components

### 1. Difficulty + FIG calculator (`frontend/src/utils/figDifficulty.js`)

Pure JS, no React, no backend. Function:

```js
computeFigDifficulty({
  quarterSoms,        // integer 0–16
  halfTwistsPerSom,   // array of integers, one per som, "-" rendered for 0
  shape,              // 'tuck' | 'pike' | 'straight' | 'straddle' | null
  landing,            // 'feet' | 'seat' | 'front' | 'back' | 'hands'
  direction,          // 'forward' | 'backward'
}) → { difficulty, figNotation, suggestedName, breakdown }
```

`breakdown` is a list of `{ label, points }` items showing how the score was assembled (e.g. "8 × ¼ som = 0.8", "Double-som bonus = 0.2", "Pike per som = 0.2", "Backward double = 0.1"). The Skill modal renders this as caption text so a coach can audit.

Rules implemented (per §17.1):

- 0.1 per ¼ somersault, 0.1 per ½ twist, plus a somersault-completion bonus that scales: 1 som = +0.1, 2 = +0.2, 3 = +0.4, 4 = +0.6 (so the totals 0.5/1.0/1.6/2.2 from §17.1.1.2–5 fall out).
- Single som 360°–630° in pike or straight, no twist: +0.1 (§17.1.4).
- Multiple som 720°+ in pike or straight, with or without twist: +0.1 per som (§17.1.5).
- Backward bonus: double 720–990° = +0.1, triple 1080–1350° = +0.2, quadruple = +0.3 (§17.1.6.1).
- Twisting double >720° twist: +0.1 per extra 180° (§17.1.6.2). Twisting triple >360° twist: +0.2 per extra 180° (§17.1.6.3). Twisting quadruple: +0.2 per 180° (§17.1.6.4).

Notation grammar (matches the existing convention in `seed-skill-difficulty.js`): `[quarterSomDigit][halfTwistsPerSom...][positionSymbol]`. Position symbols: `o` tuck, `<` pike, `v` straddle, `/` straight, `--` seat, `1-` back, `1-f` front. Zero twists render as `-`.

Suggested name uses recognised aliases (Barani, Rudi, Full, Cody, Ball-out, Half Out, Double Full, etc.) when the structured params match the canonical pattern; otherwise a descriptive fallback (e.g. "Double Back Tuck", "Full-Twisting ¾ Front").

Tested against the seeded skills in `seed-skill-difficulty.js` — every entry must round-trip.

### 2. Skill form modal (`frontend/src/pages/Levels.js`)

Replace `AddSkillModal` and `EditSkillModal` with one `SkillFormModal`. Free-text fields stay: name, description, order. New structured fields: quarter somersaults (number input 0–16), direction (radio forward / backward), half twists per somersault (a row of small number inputs whose length tracks `ceil(quarterSoms / 4)`, falling back to a single field for sub-som elements), shape (radio tuck / pike / straight / straddle), landing (select feet / seat / front / back / hands).

Below the structured fields: read-only-by-default outputs for difficulty and FIG notation, plus the calculator's `breakdown` rendered as caption text. Both outputs have an "edit override" affordance — clicking the value lets the coach type a manual override that pins the field; an inline note ("manual override — won't update from inputs") makes the override visible. A "Use suggested name" button below the name field copies the calculator's `suggestedName` into the name field.

When opening the modal in edit mode, structured fields hydrate from the skill's persisted columns; if those are blank (legacy data), the modal still works in free-text mode and the calculator outputs stay empty until the coach fills the structured inputs.

### 3. Skill schema additions (`backend/prisma/schema.prisma`)

Add to `Skill`:

- `quarterSoms` Int? — 0–16
- `halfTwistsPerSom` String? — one character per som, same encoding as the FIG digits: `-` for zero, digit `1`–`9` for the half-twist count on that som. Examples: `-` (single som no twist), `-1` (no twist first som, one half-twist second som = half-out), `2` (single som with full twist), `44` (single som with 4 half-twists rendered as `44/`). Two-digit twist counts on a single som are not supported (none in current data).
- `shape` String? — `'tuck' | 'pike' | 'straight' | 'straddle'`
- `landing` String? — `'feet' | 'seat' | 'front' | 'back' | 'hands'`
- `direction` String? — `'forward' | 'backward'`

All nullable so existing rows continue to work. `difficulty` and `figNotation` stay on the model — they remain authoritative for display/query and are now derivable.

One migration adds the columns. No backfill in the migration; coaches fill them in by editing skills (or we can run the seed script again later to populate from the structured-name table — out of scope for this spec).

### 4. Skill API changes (`backend/routes/levels.js`)

Extend `skillCreateSchema` and `skillUpdateSchema` to accept the new structured fields plus `difficulty` (decimal) and `figNotation` (string) overrides. Server stores whatever the client sends; it does not recompute. The frontend is the calculator.

`GET /levels` already returns skills inside levels — extend the include to expose the new fields. Add `GET /skills` (alphabetical, returns skills across the club with their level identifier and a `routineCount` aggregate) for the All Skills page.

### 5. All Skills page (`frontend/src/pages/Skills.js`)

Route `/skills` under `TrackingRoute` (so staff-only). New tile in the admin hub's Skill Tracking section ("All Skills"). Page renders a table:

| Name | Level | FIG | Difficulty | Used in routines | Edit |

Sort handlers on each column. Filters above the table: text input (matches `name` and `figNotation`, substring, case-insensitive) and a level dropdown. Edit launches the same `SkillFormModal`. Save round-trips through the existing `PUT /levels/:id/skills/:skillId` endpoint.

### 6. Routine search (`AddSkillToRoutineModal` in `Levels.js`)

Drop the radio toggle. The modal becomes a single search input above a results list:

- Typing filters `availableSkills` by name + figNotation (case-insensitive substring on either field).
- Each match is a clickable row with name · `L<level>` · FIG · DD.
- Clicking a match fires `onSave(skillId)`.
- Below the list, an "Add as implicit skill" button uses the current input verbatim as `customSkillName` and fires `onSave(null, customSkillName)`.

The modal is the same on desktop and mobile; only the styling tightens for narrow viewports.

## Verification

- **Calculator unit tests** (`frontend/src/utils/__tests__/figDifficulty.test.js`): every entry in `seed-skill-difficulty.js` round-trips through the calculator and produces the same `difficulty` and `figNotation`.
- **Manual smoke test**: dev server, sign in as club admin. Create a new skill via the structured form, confirm difficulty and FIG match expectations and that the breakdown caption is correct. Edit an existing skill, confirm the structured fields hydrate (they will be empty for legacy rows — fill them, save, reopen, confirm round-trip). Open All Skills, sort by difficulty, search by FIG. On a mobile viewport, add a skill to a routine using the new search.

## Out of scope

- Backfilling structured params on existing skills (deferred — seed script can be enhanced later).
- Revisiting any of the per-skill seed values that disagree with §17.1.
- Changing the implicit-skill UX outside the routine modal (e.g. the legacy free-text path on the routine view itself).
- Extending the FIG notation grammar past 8 quarter somersaults (no triples or quadruples in the current data; calculator difficulty maths still works for them, but the single-character quarter digit in the notation string would need a delimiter to be unambiguous — defer until needed).
