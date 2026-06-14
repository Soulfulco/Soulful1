---
name: Specialisms stay in sync with managed list
description: When practitioner specialisms are entered as free text (bulk import), keep the managed specialisms table in sync.
---

The admin UI drives practitioner `specialism` from a DB-managed `specialisms` table (table `specialisms`, unique `name`). Any path that accepts a free-text specialism (e.g. bulk/CSV import) must auto-create missing specialisms (case-insensitive, `onConflictDoNothing`) so the managed dropdown stays complete.

**Why:** the agreed product scope is "specialism must match the managed list or auto-create new ones"; otherwise imported practitioners reference a specialism the admin dropdown doesn't know about, and the list silently drifts.

**How to apply:** before inserting practitioners with arbitrary specialism strings, dedupe distinct specialisms, insert unknown ones into `specialismsTable`, then insert the practitioners.
