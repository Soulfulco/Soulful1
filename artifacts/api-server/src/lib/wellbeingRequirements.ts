import { db } from "@workspace/db";
import { wellbeingRequirementLogTable, employeesTable } from "@workspace/db";
import { eq, and, sql as drizzleSql } from "drizzle-orm";
import { logger } from "./logger";
import type { WellbeingRequirementKey } from "@workspace/db";

export type RequirementFrequency = "weekly" | "monthly" | "quarterly";

export type RequirementDefinition = {
  key: WellbeingRequirementKey;
  label: string;
  frequency: RequirementFrequency;
  frequencyLabel: string;
  notes: string;
  autoTracked: boolean;
};

const FREQUENCY_DAYS: Record<RequirementFrequency, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 91,
};

export const REQUIREMENTS: RequirementDefinition[] = [
  {
    key: "volunteering",
    label: "Volunteering day",
    frequency: "quarterly",
    frequencyLabel: "1 / quarter",
    notes: "",
    autoTracked: false,
  },
  {
    key: "one_on_one",
    label: "1:1 session",
    frequency: "monthly",
    frequencyLabel: "1 / month",
    notes: "With manager, coach, or wellbeing lead",
    autoTracked: true,
  },
  {
    key: "group_session",
    label: "Group session",
    frequency: "monthly",
    frequencyLabel: "1 / month",
    notes: "Team or peer-group wellbeing session",
    autoTracked: true,
  },
  {
    key: "mood_checkin",
    label: "Mood check-in",
    frequency: "weekly",
    frequencyLabel: "1 / week",
    notes: "Quick self-report; app-based or informal",
    autoTracked: true,
  },
  {
    key: "modality_suggestion",
    label: "New modality / offering suggestion",
    frequency: "monthly",
    frequencyLabel: "1 / month",
    notes: "A new practice, tool, or offering surfaced for employees to try (from Soulful)",
    autoTracked: false,
  },
  {
    key: "social_calendar",
    label: "Social calendar attendance",
    frequency: "monthly",
    frequencyLabel: "1 / month",
    notes: "At least one social calendar invite attended",
    autoTracked: true,
  },
];

export type ComplianceStatus = "on_track" | "due_soon" | "overdue" | "no_data";

export type RequirementCompliance = RequirementDefinition & {
  lastCompletedAt: string | null;
  nextDueAt: string | null;
  status: ComplianceStatus;
};

/** Log a requirement as completed for an employee. Fire-and-forget friendly (caller should .catch). */
export async function logRequirement(
  employeeId: number,
  requirementKey: WellbeingRequirementKey,
  source: "auto" | "manual",
  recordedBy?: string,
  note?: string,
): Promise<void> {
  await db.insert(wellbeingRequirementLogTable).values({
    employeeId,
    requirementKey,
    source,
    recordedBy: recordedBy ?? null,
    note: note ?? null,
  });
}

async function lastCompletedAt(employeeId: number, requirementKey: WellbeingRequirementKey): Promise<Date | null> {
  const [row] = await db
    .select({ completedAt: wellbeingRequirementLogTable.completedAt })
    .from(wellbeingRequirementLogTable)
    .where(
      and(
        eq(wellbeingRequirementLogTable.employeeId, employeeId),
        eq(wellbeingRequirementLogTable.requirementKey, requirementKey),
      ),
    )
    .orderBy(drizzleSql`${wellbeingRequirementLogTable.completedAt} DESC`)
    .limit(1);
  return row ? new Date(row.completedAt) : null;
}

function computeStatus(last: Date | null, frequency: RequirementFrequency): { status: ComplianceStatus; nextDueAt: Date | null } {
  if (!last) return { status: "no_data", nextDueAt: null };
  const days = FREQUENCY_DAYS[frequency];
  const nextDueAt = new Date(last.getTime() + days * 24 * 60 * 60 * 1000);
  const now = Date.now();
  const dueSoonThreshold = frequency === "weekly" ? 2 : frequency === "monthly" ? 5 : 10;
  const daysUntilDue = (nextDueAt.getTime() - now) / (1000 * 60 * 60 * 24);
  let status: ComplianceStatus;
  if (daysUntilDue < 0) status = "overdue";
  else if (daysUntilDue <= dueSoonThreshold) status = "due_soon";
  else status = "on_track";
  return { status, nextDueAt };
}

export async function getComplianceForEmployee(employeeId: number): Promise<RequirementCompliance[]> {
  const results: RequirementCompliance[] = [];
  for (const req of REQUIREMENTS) {
    const last = await lastCompletedAt(employeeId, req.key);
    const { status, nextDueAt } = computeStatus(last, req.frequency);
    results.push({
      ...req,
      lastCompletedAt: last ? last.toISOString() : null,
      nextDueAt: nextDueAt ? nextDueAt.toISOString() : null,
      status,
    });
  }
  return results;
}

export type EmployeeComplianceRow = {
  employeeId: number;
  employeeName: string;
  requirements: RequirementCompliance[];
};

export async function getComplianceForCompany(companyId: number): Promise<EmployeeComplianceRow[]> {
  const employees = await db
    .select({ id: employeesTable.id, name: employeesTable.name })
    .from(employeesTable)
    .where(and(eq(employeesTable.companyId, companyId), eq(employeesTable.isActive, true)));

  const rows: EmployeeComplianceRow[] = [];
  for (const emp of employees) {
    const requirements = await getComplianceForEmployee(emp.id);
    rows.push({ employeeId: emp.id, employeeName: emp.name, requirements });
  }
  return rows;
}

export async function logRequirementSafe(
  employeeId: number,
  requirementKey: WellbeingRequirementKey,
  source: "auto" | "manual" = "auto",
): Promise<void> {
  try {
    await logRequirement(employeeId, requirementKey, source);
  } catch (err) {
    logger.error({ err, employeeId, requirementKey }, "Failed to log wellbeing requirement completion");
  }
}
