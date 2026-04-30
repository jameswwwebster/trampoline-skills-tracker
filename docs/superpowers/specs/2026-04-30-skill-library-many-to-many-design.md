# Skill Library + Cross-Level Reuse Design

**Date:** 2026-04-30

## Goal

Two related changes to the skill model:

1. Skills can belong to many levels (currently each Skill belongs to exactly one Level). Coaches build levels by either creating a new skill or **looking up an existing one** from the club's skill library.
2. Populate the library with the named skills from the FIG Trampoline Code of Points 2025–2028 Section II.C ("Difficulty Trampoline – Examples") that aren't already in the database.

## Decisions captured from brainstorm

- Use **Landing** (not FIG's "Drop"). FIG `Front Drop` / `Back Drop` rows are skipped on import — they're already covered by `Front Landing` / `Back Landing`.
- No shape variants on landings. FIG's `1-o`, `1-<`, `1-/` collapse to a single `1-` Landing entry.
- Keep both `Barani` (forward) and `Back Somersault with ½ Twist` (backward) — they share the FIG notation `41o`/`41<`/`41/` but the direction differs. Backward variants are rarely used but may surface in side-track levels.
- Normalisation convention: `0` is rendered as `-` in the FIG-style notation (matches existing seed convention).

## Schema changes

```
model LevelSkill {
  id        String   @id @default(cuid())
  levelId   String
  skillId   String
  order     Int
  createdAt DateTime @default(now())
  level     Level    @relation(fields: [levelId], references: [id], onDelete: Cascade)
  skill     Skill    @relation(fields: [skillId], references: [id], onDelete: Cascade)
  @@unique([levelId, skillId])
  @@map("level_skills")
}
```

`Skill` loses its `levelId` column and `order` column (both move to `LevelSkill`). `Level.skills` becomes `Level.levelSkills` and is read through the join.

Migration:

1. Create `level_skills` table.
2. Backfill: insert one row per existing `skills` row with `levelId` and `order` copied across.
3. Drop `skills.levelId` and `skills.order`.
4. Regenerate Prisma client.

`SkillProgress.skillId` and `RoutineSkill.skillId` are unchanged — the same Skill record is referenced regardless of how many levels it belongs to. **A consequence:** a gymnast's progress on a skill is shared across every level that includes that skill. That's intentional — once mastered, mastered everywhere.

## Backend routes

`backend/routes/levels.js`:

- `POST /levels/:levelId/skills` body accepts **either**
  - `{ skillId, order? }` — attach an existing skill to this level.
  - `{ name, description?, order?, ...structuredParams }` — create a new Skill and attach to this level in one transaction.
- `DELETE /levels/:levelId/skills/:skillId` removes the `LevelSkill` row only. The Skill row is preserved.

`backend/routes/skills.js`:

- `GET /api/skills` returns each skill with `levels: [{ id, identifier, name }]` (the levels it's attached to). Library skills (no level attachments) appear with `levels: []`.
- `DELETE /api/skills/:skillId` (new) — full delete. Cascades through `LevelSkill` and `RoutineSkill`.

## Frontend changes

**Levels page edit mode** (`frontend/src/pages/Levels.js`):

- The "+ Add Skill" button becomes two: **Create new skill** (existing `SkillFormModal`) and **Add existing skill** (new `AddExistingSkillModal`).
- `AddExistingSkillModal` reuses the same search-list pattern as `AddSkillToRoutineModal` — a single text input that filters by name + FIG, each result row clickable.
- The remove icon next to a skill in the level becomes "Remove from level" (detach). The skill stays in the library.
- A separate, less-prominent "Delete skill" action is available on the All Skills page (not on the level view).

**All Skills page** (`frontend/src/pages/Skills.js`):

- "Level" column becomes a comma-separated list of level identifiers. Library-only skills show as `Library`.
- Filter "All levels" gains a `Library only` option.

## FIG import

`backend/scripts/import-fig-skills.js`:

- Hardcoded list of FIG II.C entries (~139 named-skill rows) with structured params (`quarterSoms`, `halfTwistsPerSom`, `shape`, `landing`, `direction`), `figNotation`, `difficulty`, and a canonical `name`.
- For each row: skip if a Skill already exists in the DB with the same `figNotation`. Otherwise create a Skill with no level attachment.
- Print a summary: `inserted N, skipped M (already present)`.
- Idempotent — running twice is a no-op.

Per the brainstorm decisions, the import will:

- Drop the `Front Drop` / `Back Drop` rows entirely.
- Drop the shape-variant landing rows.
- Keep `Barani` (direction=forward) and `Back Somersault with ½ Twist` (direction=backward) as separate entries when notation collides.

## Verification

- Migration runs cleanly on the prod DB (one-shot, with backfill before the column drop).
- After migration, levels still show their skills; routines still resolve their skill names.
- Import script run in dry mode (log-only flag) before live run.
- Manual smoke: create a level, attach an existing FIG skill via lookup, attach again to a different level, observe the All Skills row showing both levels.

## Out of scope

- Backfilling structured params on existing legacy skills. (The earlier spec already deferred this.)
- Reorganising progress tracking semantics — current behaviour (Skill-level progress, shared across all levels) is acceptable.
- Tumbling / DMT skill imports. The FIG document has separate II.G (tumbling) and II.I (DMT) tables; this work is trampoline-only.
