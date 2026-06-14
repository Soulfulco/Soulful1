---
name: Soulful public showcase endpoints
description: Why marketing pages must use field-projected showcase endpoints, not the full list endpoints
---

# Public marketing pages must use field-projected "showcase" endpoints

The existing `GET /companies` and `GET /practitioners` endpoints are public (no auth) AND
return full rows via `db.select()` — including PII/business data (company `email`,
`contactName`, `employeeCount`; practitioner `email`, `bio`, `sessionRateGbp`).

**Rule:** When a public/anonymous-facing page (e.g. ForCorporates, ForPractitioners marketing
banners) needs a list of entities, add a dedicated `/.../showcase` endpoint that selects only
display-safe columns, and consume that via its generated hook. Do NOT reuse the full list
endpoints on public pages.

**Why:** Reusing the full list endpoints ships PII to every anonymous visitor's browser. A code
review flagged this as blocking. Showcase endpoints (`listCompanyShowcase` → {id,name,logoUrl};
`listPractitionerShowcase` → {id,name,specialism,avatarUrl}) keep the payload safe.

**How to apply:**
- Add schema + path to `lib/api-spec/openapi.yaml`, then `pnpm --filter @workspace/api-spec run codegen`.
- Register the `/practitioners/showcase` and `/companies/showcase` routes BEFORE the
  `/:id` routes in the route files, or Express captures "showcase" as the `:id` param.
- Restart `artifacts/api-server: API Server` after route edits (esbuild bundle).
