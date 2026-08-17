import { OAuth2Client } from "google-auth-library";
import { logger } from "./logger";
import { apiBaseUrl } from "./url";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
];

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Previously read process.env.REPLIT_DOMAINS, which only exists inside
// Replit's own infrastructure — this threw "REPLIT_DOMAINS not set" on
// Railway. baseUrl() (this same lib/url.ts used elsewhere) reads APP_URL
// instead, which works on any host.
export function getRedirectUri(callbackPath = "/api/practitioner/google/callback"): string {
    return `${apiBaseUrl()}${callbackPath}`;
  }

function oauthClient(callbackPath?: string): OAuth2Client {
  return new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: getRedirectUri(callbackPath),
  });
}

export function getAuthUrl(state: string, callbackPath?: string): string {
  return oauthClient(callbackPath).generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export interface ExchangeResult {
  refreshToken: string | null;
  email: string | null;
}

export async function exchangeCode(code: string, callbackPath?: string): Promise<ExchangeResult> {
  const client = oauthClient(callbackPath);
  const { tokens } = await client.getToken(code);
  let email: string | null = null;
  if (tokens.id_token) {
    try {
      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      email = ticket.getPayload()?.email ?? null;
    } catch (err) {
      logger.warn({ err }, "Failed to read email from Google id_token");
    }
  }
  return { refreshToken: tokens.refresh_token ?? null, email };
}

async function getAccessToken(refreshToken: string): Promise<string> {
  const client = oauthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Failed to obtain Google access token");
  return token;
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export async function getFreeBusy(
  refreshToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyInterval[]> {
  const accessToken = await getAccessToken(refreshToken);
  const resp = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: "primary" }],
    }),
  });
  if (!resp.ok) {
    throw new Error(`Google freeBusy failed: ${resp.status} ${await resp.text()}`);
  }
  const data = (await resp.json()) as {
    calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
  };
  const busy = data.calendars?.primary?.busy ?? [];
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export interface CalendarEventInput {
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  attendeeEmail?: string;
}

export async function createEvent(
  refreshToken: string,
  event: CalendarEventInput,
): Promise<string> {
  const accessToken = await getAccessToken(refreshToken);
  const resp = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.start.toISOString() },
        end: { dateTime: event.end.toISOString() },
        attendees: event.attendeeEmail ? [{ email: event.attendeeEmail }] : undefined,
      }),
    },
  );
  if (!resp.ok) {
    throw new Error(`Google createEvent failed: ${resp.status} ${await resp.text()}`);
  }
  const data = (await resp.json()) as { id: string };
  return data.id;
}

export async function deleteEvent(refreshToken: string, eventId: string): Promise<void> {
  const accessToken = await getAccessToken(refreshToken);
  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  // 410 = already deleted, 404 = not found — both are acceptable end states.
  if (!resp.ok && resp.status !== 410 && resp.status !== 404) {
    throw new Error(`Google deleteEvent failed: ${resp.status} ${await resp.text()}`);
  }
}