import { Router } from "express";
import { db } from "@workspace/db";
import { employeesTable, companiesTable, bookingsTable } from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

// ── /employees/* ──────────────────────────────────────────────────────────────
export const employeesRouter = Router();

// POST /employees — register or find existing employee
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

// POST /employees/login — passwordless lookup by email + companyId
employeesRouter.post("/employees/login", async (req, res) => {
  try {
    const { email, companyId } = req.body;
    if (!email || !companyId) {
      return res.status(400).json({ error: "email and companyId are required" });
    }
    const [employee] = await db
      .select()
      .from(employeesTable)
      .where(and(eq(employeesTable.email, email), eq(employeesTable.companyId, companyId)))
      .limit(1);
    if (!employee) return res.status(404).json({ error: "Employee not found" });
    return res.json(employee);
  } catch {
    return res.status(500).json({ error: "Failed to login" });
  }
});

// GET /employees/:id
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

// GET /employees/:id/bookings
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

// ── /companies/* employee-related routes ─────────────────────────────────────
export const companyEmployeesRouter = Router();

// GET /companies/join/:code — resolve invite code to company info (public)
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

// GET /companies/:id/employees — list employees for a company
companyEmployeesRouter.get("/companies/:id/employees", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
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

// GET /companies/:id/utilisation — usage stats for HR dashboard
companyEmployeesRouter.get("/companies/:id/utilisation", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
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
