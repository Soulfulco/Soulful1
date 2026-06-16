import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type PractitionerRates = {
  sessionRateGbp: number;
  inPersonRateGbp?: number | null;
  onlineRateGbp?: number | null;
};

export function practitionerRates(p: PractitionerRates): { label: string; value: number }[] {
  const rates: { label: string; value: number }[] = [];
  if (p.inPersonRateGbp != null) rates.push({ label: "In-person", value: p.inPersonRateGbp });
  if (p.onlineRateGbp != null) rates.push({ label: "Online", value: p.onlineRateGbp });
  if (rates.length === 0) rates.push({ label: "Session", value: p.sessionRateGbp });
  return rates;
}

export function rateSummary(p: PractitionerRates): string {
  const rates = practitionerRates(p);
  if (rates.length === 1) return `£${rates[0].value} / session`;
  return rates.map((r) => `£${r.value} ${r.label.toLowerCase()}`).join(" · ");
}
