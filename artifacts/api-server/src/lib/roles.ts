import { type Request } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export function isHr(req: Request): boolean {
  return req.isAuthenticated() && req.user.id.startsWith("hr:");
}

export function isPractitioner(req: Request): boolean {
  return req.isAuthenticated() && req.user.id.startsWith("pract:");
}

export function isEmployee(req: Request): boolean {
  return req.isAuthenticated() && req.user.id.startsWith("employee:");
}

export function isAdmin(req: Request): boolean {
  return (
    req.isAuthenticated() &&
    !req.user.id.startsWith("hr:") &&
    !req.user.id.startsWith("pract:") &&
    !req.user.id.startsWith("employee:")
  );
}

export function practitionerId(req: Request): number | null {
  if (!isPractitioner(req)) return null;
  const id = Number(req.user!.id.slice("pract:".length));
  return Number.isNaN(id) ? null : id;
}

export function employeeId(req: Request): number | null {
  if (!isEmployee(req)) return null;
  const id = Number(req.user!.id.slice("employee:".length));
  return Number.isNaN(id) ? null : id;
}

export async function resolveHrCompanyId(req: Request): Promise<number | null> {
  if (!isHr(req)) return null;
  const hrId = Number(req.user!.id.slice("hr:".length));
  if (Number.isNaN(hrId)) return null;
  const result = await db.execute(sql`SELECT company_id FROM hr_users WHERE id = ${hrId}`);
  const row = result.rows[0] as { company_id?: number } | undefined;
  return row?.company_id ?? null;
}
