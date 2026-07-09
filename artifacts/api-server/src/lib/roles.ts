import { type Request } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// Session user ids are prefixed by account type:
//   "hr:<id>"     → HR portal user (scoped to one company)
//   "pract:<id>"  → practitioner portal user
//   anything else → Soulful platform admin (Replit-authenticated)

export function isHr(req: Request): boolean {
  return req.isAuthenticated() && req.user.id.startsWith("hr:");
}

export function isPractitioner(req: Request): boolean {
  return req.isAuthenticated() && req.user.id.startsWith("pract:");
}

export function isAdmin(req: Request): boolean {
  return (
    req.isAuthenticated() &&
    !req.user.id.startsWith("hr:") &&
    !req.user.id.startsWith("pract:")
  );
}

export function practitionerId(req: Request): number | null {
  if (!isPractitioner(req)) return null;
  const id = Number(req.user!.id.slice("pract:".length));
  return Number.isNaN(id) ? null : id;
}

/**
 * Resolves the companyId an HR session is scoped to, by looking it up
 * server-side from the hr_users table — never trust a client-supplied
 * companyId for access