import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { employeesTable, companiesTable, bookingsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isAdmin, employeeId } from "../lib/roles";
import { createSession, clearSession, getSessionId, SESSION_COOKIE, SESSION_TTL } from "../lib/auth";

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}
function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}
function setSessionCookie(res: any, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

async function authorizeCompanyWrite(req: Request, res: Response, companyId: number): Promise<boolean> {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Not authenticated" });
    return false;
  }
  const uid = req.user.id;
  if (uid.startsWith("hr:")) {
    const hrId = parseInt(uid.slice(3));
    const result = await db.execute(sql`SELECT company_id FROM hr_users WHERE id = ${hrId} AND is_active = true`);
    const row = result.rows[0] as { company_id?: number } | undefined;
    if (!row || row.company_id !== companyId) {
      res.status(403).json({ error: "Forbidden" });
      return false;
    }
    return true;
  }
  if (!isAdmin(req)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

export const employeesRouter = Router();

employeesRouter.post("/employees", async (req, res) => {
  try {
    const { name, email, companyId, sessionAllowancePerMonth } = req.body;
    if (!name || !email || !companyId) {
      return res.status(400).json({ error: "name, email, and companyId are required" });
    }
    const existing = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.email, email), eq(employeesTable.companyId, companyId)))
      .limit(1);
    if (existing.length > 0) return res.status(200).json(existing[0]);

    const [employee] = await db
      .insert(employeesTable)
      .values({ name, email, companyId, sessionAllowancePerMonth: sessionAllowancePerMonth ?? 2 })
      .returning();
    return res.status(201).json(employee);
  } catch {
    return res.status(500).json({ error: "Failed to register employee" });
  }
});

employeesRouter.post("/employees/claim", async (req, res) => {
  try {
    const { email, companyId, password } = req.body ?? {};
    if (!email || !companyId || !password) {
      return res.status(400).json({ error: "email, companyId, and password are required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.email, String(email).toLowerCase().trim()), eq(employeesTable.companyId, companyId)))
      .limit(1);
    if (!employee) return res.status(404).json({ error: "No employee record found for this email" });
    if (employee.passwordHash) {
      return res.status(409).json({ error: "This account has already been set up — please log in instead" });
    }

    const passwordHash = hashPassword(password);
    await db.update(employeesTable).set({ passwordHash }).where(eq(employeesTable.id, employee.id));

    const sessionData = {
      user: {
        id: `employee:${employee.id}`,
        email: employee.email,
        firstName: employee.name.split(" ")[0] ?? employee.name,
        lastName: employee.name.split(" ").slice(1).join(" ") || null,
        profileImageUrl: null,
      },
      employeeId: employee.id,
      access_token: "",
    };
    const sid = await createSession(sessionData as any);
    setSessionCookie(res, sid);
    res.status(201).json({ ok: true, user: sessionData.user });
  } catch (err) {
    res.status(500).json({ error: "Failed to set up account" });
  }
});

employeesRouter.post("/employees/login", async (req, res) => {
  try {
    const { email, companyId, password } = req.body ?? {};
    if (!email || !companyId || !password) {
      return res.status(400).json({ error: "email, companyId, and password are required" });
    }
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.email, String(email).toLowerCase().trim()), eq(employeesTable.companyId, companyId)))
      .limit(1);
    if (!employee || !employee.passwordHash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (!verifyPassword(password, employee.passwordHash)) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const sessionData = {
      user: {
        id: `employee:${employee.id}`,
        email: employee.email,
        firstName: employee.name.split(" ")[0] ?? employee.name,
        lastName: employee.name.split(" ").slice(1).join(" ") || null,
        profileImageUrl: null,
      },
      employeeId: employee.id,
      access_token: "",
    };
    const sid = await createSession(sessionData as any);
    setSessionCookie(res, sid);
    res.json({ ok: true, user: sessionData.user });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

employeesRouter.post("/employees/logout", async (req, res) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.json({ ok: true });
});

employeesRouter.patch("/employee/password", async (req, res) => {
  const id = employeeId(req);
  if (!id) return res.status(401).json({ error: "Not authenticated" });
  try {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword and newPassword are required" });
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters" });
    }
    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
    if (!employee || !employee.passwordHash) return res.status(404).json({ error: "Employee not found" });
    if (!verifyPassword(currentPassword, employee.passwordHash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    await db.update(employeesTable).set({ passwordHash: hashPassword(newPassword) }).where(eq(employeesTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to change password" });
  }
});

employeesRouter.get("/employees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id)).limit(1);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    return res.json(employee);
  } catch {
    return res.status(500).json({ error: "Failed to fetch employee" });
  }
});

employeesRouter.get("/employees/:id/bookings", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, id)).limit(1);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    const bookings = await db
      .select()
      .from(bookingsTable)
      .where(and(eq(bookingsTable.companyId, employee.companyId), eq(bookingsTable.employeeEmail, employee.email)));
    return res.json(bookings);
  } catch {
    return res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

export const companyEmployeesRouter = Router();

companyEmployeesRouter.get("/companies/join/:code", async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const [company] = await db
      .select({ id: companiesTable.id, name: companiesTable.name, inviteCode: companiesTable.inviteCode, logoUrl: companiesTable.logoUrl })
      .from(companiesTable)
      .where(eq(companiesTable.inviteCode, code))
      .limit(1);
    if (!company) return res.status(404).json({ error: "Invalid invite code" });
    return res.json(company);
  } catch {
    return res.status(500).json({ error: "Failed to resolve invite code" });
  }
});

companyEmployeesRouter.get("/companies/:id/employees", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid company id" });
    if (!(await authorizeCompanyWrite(req, res, id))) return;
    const employees = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.companyId, id))
      .orderBy(employeesTable.name);
    return res.json(employees);
  } catch {
    return res.status(500).json({ error: "Failed to fetch employees" });
  }
});

companyEmployeesRouter.post("/companies/:id/employees/bulk", async (req, res) => {
  try {
    const companyId = parseInt(req.params.id);
    if (Number.isNaN(companyId)) {
      return res.status(400).json({ error: "Invalid company id" });
    }
    if (!(await authorizeCompanyWrite(req, res, companyId))) return;
    const [company] = await db.select().from(companiesTable).where(eq(companiesTable.id, companyId)).limit(1);
    if (!company) return res.status(404).json({ error: "Company not found" });

    const rows = Array.isArray(req.body?.employees) ? req.body.employees : null;
    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: "employees must be a non-empty array" });
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const existing = await db
      .select({ email: employeesTable.email })
      .from(employeesTable)
      .where(eq(employeesTable.companyId, companyId));
    const seen = new Set(existing.map(e => e.email.toLowerCase()));

    const toInsert: { name: string; email: string; companyId: number; sessionAllowancePerMonth: number }[] = [];
    const invalid: { row: number; reason: string }[] = [];

    rows.forEach((raw: unknown, i: number) => {
      const r = raw as { name?: unknown; email?: unknown; sessionAllowancePerMonth?: unknown };
      const name = typeof r.name === "string" ? r.name.trim() : "";
      const email = typeof r.email === "string" ? r.email.trim() : "";
      if (!name || !email) return invalid.push({ row: i + 1, reason: "missing name or email" });
      if (!emailRe.test(email)) return invalid.push({ row: i + 1, reason: "invalid email" });
      const key = email.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const allowance = Number(r.sessionAllowancePerMonth);
      toInsert.push({
        name,
        email,
        companyId,
        sessionAllowancePerMonth: Number.isInteger(allowance) && allowance > 0 ? allowance : 2,
      });
    });

    const created = toInsert.length > 0 ? await db.insert(employeesTable).values(toInsert).returning() : [];
    return res.status(201).json({
      created: created.length,
      skipped: rows.length - created.length - invalid.length,
      invalid,
      employees: created,
    });
  } catch {
    return res.status(500).json({ error: "Failed to import employees" });
  }
});

companyEmployeesRouter.get("/companies/:id/utilisation", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid company id" });
    if (!(await authorizeCompanyWrite(req, res, id))) return;
    const employees = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.companyId, id));

    const totalEmployees = employees.length;
    const activeThisMonth = employees.filter(e => e.sessionsUsedThisMonth > 0).length;
    const sessionsBooked = employees.reduce((sum, e) => sum + e.sessionsUsedThisMonth, 0);
    const totalAllowance = employees.reduce((sum, e) => sum + e.sessionAllowancePerMonth, 0);
    const utilisationRate = totalAllowance > 0 ? Math.round((sessionsBooked / totalAllowance) * 100) / 100 : 0;

    return res.json({ totalEmployees, activeThisMonth, sessionsBooked, totalAllowance, utilisationRate });
  } catch {
    return res.status(500).json({ error: "Failed to fetch utilisation" });
  }
});