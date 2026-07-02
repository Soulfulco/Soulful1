---
name: Drizzle sql`` tagged template and array params
description: How to pass a JS array into a raw drizzle sql`` template for a Postgres array column
---

Interpolating a JS array directly into a drizzle `sql\`...\`` template (e.g. `sql\`... = COALESCE(${myArray}, col)\``) does NOT produce a Postgres array parameter — drizzle passes the array as a single malformed param, causing `COALESCE types record and text[] cannot be matched` or similar type errors.

**Why:** drizzle's raw `sql` tag has no special-case array handling; it just binds the JS value as one query param, and pg driver can't infer `text[]` from a bare JS array in that position.

**How to apply:** Build the Postgres array literal string yourself and cast it explicitly, e.g.:
```ts
const literal = items ? `{${items.map(i => `"${i}"`).join(",")}}` : null;
sql`... = COALESCE(${literal}::text[], col)`
```
Apply this pattern anywhere a raw `sql` template needs to write/compare a Postgres array column from a JS array.
