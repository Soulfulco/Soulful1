// Insurance expiry rules, shared by the booking, group-session and directory code.
//
// Expiry dates are plain calendar dates ("2027-03-31"). A certificate is valid *through* its
// expiry date, so it only counts as expired the day after. "Today" is the date in the UK rather
// than UTC, so a certificate doesn't lapse an hour early or late around midnight in summer.

export function todayInLondon(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// A practitioner with no expiry date recorded is NOT treated as expired: practitioners who
// uploaded a certificate before dates were collected stay bookable until they add one.
export function isInsuranceExpired(expiresOn: string | null | undefined, now: Date = new Date()): boolean {
  return typeof expiresOn === "string" && expiresOn !== "" && expiresOn < todayInLondon(now);
}

// Whole days from today until the expiry date (negative once it has passed), or null if no date.
export function daysUntilExpiry(expiresOn: string | null | undefined, now: Date = new Date()): number | null {
  if (typeof expiresOn !== "string" || expiresOn === "") return null;
  const [ey, em, ed] = expiresOn.split("-").map(Number);
  const [ty, tm, td] = todayInLondon(now).split("-").map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(ty, tm - 1, td)) / 86400000);
}

// Accepts only a real calendar date written YYYY-MM-DD, from the year 2000 to ten years ahead.
// Returns the date, or null if it isn't acceptable.
export function parseExpiryDate(value: unknown, now: Date = new Date()): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 2000) return null;
  const today = todayInLondon(now);
  if (value > `${Number(today.slice(0, 4)) + 10}${today.slice(4)}`) return null;
  return value;
}
