import { db } from "@workspace/db";
import { gamificationActivityTable, employeeBadgesTable, employeesTable } from "@workspace/db";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { logger } from "./logger";
import type { GamificationActivityType, BadgeKey } from "@workspace/db";

export const POINTS: Record<GamificationActivityType, number> = {
  wellbeing_checkin: 50,
  booking_1on1: 100,
  group_session: 75,
  social_rsvp: 50,
  profile_complete: 25,
  streak_bonus: 150,
  monthly_milestone: 250,
};

export const BADGE_INFO: Record<BadgeKey, { name: string; description: string; category: string; emoji: string }> = {
  first_step: { name: "First Step", description: "Booked your first 1-on-1 session", category: "Getting Started", emoji: "🌱" },
  profile_done: { name: "Profile Done", description: "Completed your personalisation setup", category: "Getting Started", emoji: "✅" },
  first_checkin: { name: "First Check-in", description: "Submitted your first wellbeing check-in", category: "Getting Started", emoji: "📝" },
  team_player: { name: "Team Player", description: "Joined your first group session", category: "Community", emoji: "🤝" },
  social_butterfly: { name: "Social Butterfly", description: "RSVP'd to 3 social events", category: "Community", emoji: "🦋" },
  group_regular: { name: "Group Regular", description: "Attended 5 group sessions", category: "Community", emoji: "👥" },
  mindful: { name: "Mindful", description: "Completed 5 wellbeing check-ins", category: "Mindfulness", emoji: "🧘" },
  consistent: { name: "Consistent", description: "Kept a 4-week activity streak", category: "Mindfulness", emoji: "🔥" },
  monthly_warrior: { name: "Monthly Warrior", description: "Hit a monthly milestone across all activity types", category: "Mindfulness", emoji: "🏆" },
  five_sessions: { name: "5 Sessions", description: "Booked 5 one-on-one sessions", category: "Milestones", emoji: "⭐" },
  ten_sessions: { name: "10 Sessions", description: "Booked 10 one-on-one sessions", category: "Milestones", emoji: "🌟" },
  six_month_veteran: { name: "6-Month Veteran", description: "Been part of Soulful for 6 months", category: "Milestones", emoji: "🎖️" },
};

function levelForPoints(points: number): { level: number; pointsIntoLevel: number; pointsForNextLevel: number } {
  const perLevel = 300;
  const level = Math.floor(points / perLevel) + 1;
  const pointsIntoLevel = points % perLevel;
  return { level, pointsIntoLevel, pointsForNextLevel: perLevel };
}

async function countActivity(employeeId: number, activityType: GamificationActivityType): Promise<number> {
  const result = await db.execute(drizzleSql`
    SELECT COUNT(*)::int AS cnt FROM gamification_activity
    WHERE employee_id = ${employeeId} AND activity_type = ${activityType}
  `);
  return Number((result.rows[0] as { cnt: number } | undefined)?.cnt ?? 0);
}

async function hasBadge(employeeId: number, badgeKey: BadgeKey): Promise<boolean> {
  const [row] = await db
    .select({ id: employeeBadgesTable.id })
    .from(employeeBadgesTable)
    .where(drizzleSql`${employeeBadgesTable.employeeId} = ${employeeId} AND ${employeeBadgesTable.badgeKey} = ${badgeKey}`)
    .limit(1);
  return Boolean(row);
}

async function awardBadge(employeeId: number, badgeKey: BadgeKey): Promise<boolean> {
  const result = await db
    .insert(employeeBadgesTable)
    .values({ employeeId, badgeKey })
    .onConflictDoNothing()
    .returning();
  return result.length > 0;
}

/** Evaluate all badge rules for an employee and award any newly-earned badges. Returns the badges newly earned. */
export async function checkAndAwardBadges(employeeId: number): Promise<BadgeKey[]> {
  const newlyEarned: BadgeKey[] = [];

  const [checkins, bookings, groupSessions, socialRsvps, profileCompletions, streakBonuses, monthlyMilestones] = await Promise.all([
    countActivity(employeeId, "wellbeing_checkin"),
    countActivity(employeeId, "booking_1on1"),
    countActivity(employeeId, "group_session"),
    countActivity(employeeId, "social_rsvp"),
    countActivity(employeeId, "profile_complete"),
    countActivity(employeeId, "streak_bonus"),
    countActivity(employeeId, "monthly_milestone"),
  ]);

  const [employee] = await db.select({ createdAt: employeesTable.createdAt }).from(employeesTable).where(eq(employeesTable.id, employeeId)).limit(1);
  const tenureMonths = employee
    ? (Date.now() - new Date(employee.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)
    : 0;

  const rules: Array<[BadgeKey, boolean]> = [
    ["first_step", bookings >= 1],
    ["profile_done", profileCompletions >= 1],
    ["first_checkin", checkins >= 1],
    ["team_player", groupSessions >= 1],
    ["social_butterfly", socialRsvps >= 3],
    ["group_regular", groupSessions >= 5],
    ["mindful", checkins >= 5],
    ["consistent", streakBonuses >= 1],
    ["monthly_warrior", monthlyMilestones >= 1],
    ["five_sessions", bookings >= 5],
    ["ten_sessions", bookings >= 10],
    ["six_month_veteran", tenureMonths >= 6],
  ];

  for (const [badgeKey, eligible] of rules) {
    if (!eligible) continue;
    if (await hasBadge(employeeId, badgeKey)) continue;
    const awarded = await awardBadge(employeeId, badgeKey);
    if (awarded) newlyEarned.push(badgeKey);
  }

  return newlyEarned;
}

export type AwardResult = {
  pointsAwarded: number;
  totalPoints: number;
  levelBefore: number;
  levelAfter: number;
  newBadges: BadgeKey[];
};

/** Record a points-earning activity, then check for badge/level-up unlocks. */
export async function awardPoints(employeeId: number, activityType: GamificationActivityType): Promise<AwardResult> {
  const totalsBefore = await getTotalPoints(employeeId);
  const levelBefore = levelForPoints(totalsBefore).level;

  const points = POINTS[activityType];
  await db.insert(gamificationActivityTable).values({ employeeId, activityType, points });

  await maybeAwardStreakAndMilestoneBonuses(employeeId);

  const totalsAfter = await getTotalPoints(employeeId);
  const levelAfter = levelForPoints(totalsAfter).level;

  const newBadges = await checkAndAwardBadges(employeeId);

  logger.info({ employeeId, activityType, points, totalsAfter }, "Gamification points awarded");

  return { pointsAwarded: points, totalPoints: totalsAfter, levelBefore, levelAfter, newBadges };
}

async function getTotalPoints(employeeId: number): Promise<number> {
  const result = await db.execute(drizzleSql`
    SELECT COALESCE(SUM(points), 0)::int AS total FROM gamification_activity WHERE employee_id = ${employeeId}
  `);
  return Number((result.rows[0] as { total: number } | undefined)?.total ?? 0);
}

/** Checks whether the employee has hit a 4-week activity streak or a monthly all-round milestone, awarding bonus points once per period. */
async function maybeAwardStreakAndMilestoneBonuses(employeeId: number): Promise<void> {
  // 4-week streak: at least one activity (excluding bonuses) in each of the last 4 distinct ISO weeks, not already rewarded this week.
  const weeksResult = await db.execute(drizzleSql`
    SELECT DISTINCT DATE_TRUNC('week', created_at) AS week
    FROM gamification_activity
    WHERE employee_id = ${employeeId}
      AND activity_type NOT IN ('streak_bonus', 'monthly_milestone')
    ORDER BY week DESC
    LIMIT 4
  `);
  if (weeksResult.rows.length === 4) {
    const weeks = weeksResult.rows.map((r) => new Date((r as { week: string }).week).getTime());
    const isConsecutive = weeks.every((w, i) => i === 0 || weeks[i - 1] - w === 7 * 24 * 60 * 60 * 1000);
    if (isConsecutive) {
      const alreadyAwardedThisWeek = await db.execute(drizzleSql`
        SELECT 1 FROM gamification_activity
        WHERE employee_id = ${employeeId} AND activity_type = 'streak_bonus'
          AND created_at >= DATE_TRUNC('week', now())
        LIMIT 1
      `);
      if (alreadyAwardedThisWeek.rows.length === 0) {
        await db.insert(gamificationActivityTable).values({ employeeId, activityType: "streak_bonus", points: POINTS.streak_bonus });
      }
    }
  }

  // Monthly milestone: activity across all four category types (checkin, booking, group, social) within the current calendar month.
  const monthTypes = await db.execute(drizzleSql`
    SELECT DISTINCT activity_type FROM gamification_activity
    WHERE employee_id = ${employeeId}
      AND activity_type IN ('wellbeing_checkin', 'booking_1on1', 'group_session', 'social_rsvp')
      AND created_at >= DATE_TRUNC('month', now())
  `);
  if (monthTypes.rows.length >= 4) {
    const alreadyAwardedThisMonth = await db.execute(drizzleSql`
      SELECT 1 FROM gamification_activity
      WHERE employee_id = ${employeeId} AND activity_type = 'monthly_milestone'
        AND created_at >= DATE_TRUNC('month', now())
      LIMIT 1
    `);
    if (alreadyAwardedThisMonth.rows.length === 0) {
      await db.insert(gamificationActivityTable).values({ employeeId, activityType: "monthly_milestone", points: POINTS.monthly_milestone });
    }
  }
}

export type GamificationSummary = {
  employeeId: number;
  totalPoints: number;
  level: number;
  pointsIntoLevel: number;
  pointsForNextLevel: number;
  badges: Array<{ key: BadgeKey; name: string; description: string; category: string; emoji: string; earnedAt: string }>;
  recentActivity: Array<{ activityType: GamificationActivityType; points: number; createdAt: string }>;
  currentStreakWeeks: number;
};

export async function getGamificationSummary(employeeId: number): Promise<GamificationSummary> {
  const totalPoints = await getTotalPoints(employeeId);
  const { level, pointsIntoLevel, pointsForNextLevel } = levelForPoints(totalPoints);

  const badgeRows = await db
    .select()
    .from(employeeBadgesTable)
    .where(eq(employeeBadgesTable.employeeId, employeeId));

  const badges = badgeRows
    .map((b) => {
      const info = BADGE_INFO[b.badgeKey as BadgeKey];
      if (!info) return null;
      return { key: b.badgeKey as BadgeKey, ...info, earnedAt: b.earnedAt.toISOString() };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null)
    .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());

  const recentRows = await db
    .select()
    .from(gamificationActivityTable)
    .where(eq(gamificationActivityTable.employeeId, employeeId))
    .orderBy(drizzleSql`created_at DESC`)
    .limit(10);

  const recentActivity = recentRows.map((r) => ({
    activityType: r.activityType as GamificationActivityType,
    points: r.points,
    createdAt: r.createdAt.toISOString(),
  }));

  const weeksResult = await db.execute(drizzleSql`
    SELECT DISTINCT DATE_TRUNC('week', created_at) AS week
    FROM gamification_activity
    WHERE employee_id = ${employeeId} AND activity_type NOT IN ('streak_bonus', 'monthly_milestone')
    ORDER BY week DESC
    LIMIT 12
  `);
  let currentStreakWeeks = 0;
  const weeks = weeksResult.rows.map((r) => new Date((r as { week: string }).week).getTime());
  for (let i = 0; i < weeks.length; i++) {
    if (i === 0) {
      currentStreakWeeks = 1;
      continue;
    }
    if (weeks[i - 1] - weeks[i] === 7 * 24 * 60 * 60 * 1000) {
      currentStreakWeeks++;
    } else {
      break;
    }
  }

  return {
    employeeId,
    totalPoints,
    level,
    pointsIntoLevel,
    pointsForNextLevel,
    badges,
    recentActivity,
    currentStreakWeeks,
  };
}
