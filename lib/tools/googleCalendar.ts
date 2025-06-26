import { tool } from "@langchain/core/tools";
import { google } from "googleapis";
import { z } from "zod";

// Helper to get an authenticated Google Calendar client
async function getCalendarClient() {
  // Use your preferred auth method (service account, OAuth2, etc.)
  // Example: Service Account
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  const calendar = google.calendar({ version: "v3", auth });
  return calendar;
}

// Read Calendar Tool
export const readCalendarTool = tool(
  async ({ calendarId, timeMin, timeMax, maxResults }) => {
    const calendar = await getCalendarClient();
    const res = await calendar.events.list({
      calendarId,
      timeMin: timeMin || new Date().toISOString(),
      timeMax,
      maxResults: maxResults || 10,
      singleEvents: true,
      orderBy: "startTime",
    });
    return JSON.stringify(res.data.items || []);
  },
  {
    name: "read_calendar",
    description: "Read upcoming events from Google Calendar. Returns a list of events.",
    schema: z.object({
      calendarId: z.string().describe("The calendar ID (usually user's email)"),
      timeMin: z.string().optional().describe("Start time (ISO8601), defaults to now"),
      timeMax: z.string().optional().describe("End time (ISO8601), optional"),
      maxResults: z.number().optional().describe("Max number of events to return"),
    }),
  }
);

// Write Calendar Tool
export const writeCalendarTool = tool(
  async ({ calendarId, summary, description, start, end }) => {
    const calendar = await getCalendarClient();
    const res = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary,
        description,
        start: { dateTime: start },
        end: { dateTime: end },
      },
    });
    return JSON.stringify(res.data);
  },
  {
    name: "write_calendar",
    description: "Create a new event in Google Calendar.",
    schema: z.object({
      calendarId: z.string().describe("The calendar ID (usually user's email)"),
      summary: z.string().describe("Event title"),
      description: z.string().optional().describe("Event description"),
      start: z.string().describe("Start time (ISO8601)"),
      end: z.string().describe("End time (ISO8601)"),
    }),
  }
);