import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createDAVClient } from "tsdav";

// Calendar configuration schema for validation
const CalendarConfigSchema = z.object({
  caldavUrl: z.string().url(),
  email: z.string().email(),
  password: z.string(),
  authMethod: z.enum(["Basic", "Digest"]).default("Basic"),
});

// Get calendar configuration from environment variables
function getCalendarConfig() {
  const config = {
    caldavUrl: process.env.CALENDAR_CALDAV_URL || "",
    email: process.env.CALENDAR_EMAIL || process.env.EMAIL_ADDRESS || "",
    password: process.env.CALENDAR_PASSWORD || process.env.EMAIL_PASSWORD || "",
    authMethod: (process.env.CALENDAR_AUTH_METHOD as "Basic" | "Digest") || "Basic",
  };

  return CalendarConfigSchema.parse(config);
}

// Enhanced date utilities
class DateUtils {
  static parseRelativeDate(input: string, referenceDate: Date = new Date()): { start: Date; end: Date } {
    const now = new Date(referenceDate);
    const lowerInput = input.toLowerCase().trim();
    
    // Today
    if (lowerInput.includes('today')) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    // Tomorrow
    if (lowerInput.includes('tomorrow')) {
      const start = new Date(now);
      start.setDate(now.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    // This week (current week)
    if (lowerInput.includes('this week')) {
      const start = new Date(now);
      const dayOfWeek = start.getDay();
      const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(start);
      end.setDate(start.getDate() + 6); // Sunday
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    // Next week
    if (lowerInput.includes('next week')) {
      const start = new Date(now);
      const dayOfWeek = start.getDay();
      const diff = start.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Monday
      start.setDate(diff + 7); // Next Monday
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(start);
      end.setDate(start.getDate() + 6); // Next Sunday
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    // This month
    if (lowerInput.includes('this month')) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    
    // Next month
    if (lowerInput.includes('next month')) {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);
      return { start, end };
    }
    
    // Next X days
    const daysMatch = lowerInput.match(/next (\d+) days?/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(now.getDate() + days);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    // Default: next 7 days
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  static formatDateForDisplay(date: Date, timezone: string): string {
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  static parseEventDateTime(dateStr: string): Date | null {
    try {
      // Handle YYYYMMDDTHHMMSSZ format
      if (dateStr && dateStr.match(/^\d{8}T\d{6}Z?$/)) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(dateStr.substring(9, 11));
        const minute = parseInt(dateStr.substring(11, 13));
        const second = parseInt(dateStr.substring(13, 15));
        
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      }
      
      // Handle VALUE=DATE:YYYYMMDD format
      if (dateStr && dateStr.includes('VALUE=DATE:')) {
        const dateOnly = dateStr.split(':')[1];
        const year = parseInt(dateOnly.substring(0, 4));
        const month = parseInt(dateOnly.substring(4, 6)) - 1;
        const day = parseInt(dateOnly.substring(6, 8));
        
        return new Date(year, month, day);
      }
      
      // Try standard date parsing
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  // Check if two events overlap
  static eventsOverlap(event1Start: Date, event1End: Date, event2Start: Date, event2End: Date): boolean {
    return event1Start < event2End && event1End > event2Start;
  }
}

// Helper to parse iCal events with better error handling
function parseICalEvent(data: string): any {
  const lines = data.split(/\r?\n/);
  const event: any = {
    raw: data
  };
  
  let currentKey = '';
  
  for (const line of lines) {
    // Handle line continuations (lines starting with space)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (currentKey && event[currentKey]) {
        event[currentKey] += line.trim();
      }
      continue;
    }
    
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1);
    
    // Extract the main key (before any parameters)
    const mainKey = key.split(';')[0];
    
    switch (mainKey) {
      case 'SUMMARY':
        event.summary = value.trim();
        currentKey = 'summary';
        break;
      case 'DTSTART':
        event.startRaw = key + ':' + value;
        event.start = DateUtils.parseEventDateTime(value.trim());
        currentKey = 'start';
        break;
      case 'DTEND':
        event.endRaw = key + ':' + value;
        event.end = DateUtils.parseEventDateTime(value.trim());
        currentKey = 'end';
        break;
      case 'DESCRIPTION':
        event.description = value.trim().replace(/\\n/g, '\n');
        currentKey = 'description';
        break;
      case 'LOCATION':
        event.location = value.trim();
        currentKey = 'location';
        break;
      case 'UID':
        event.uid = value.trim();
        currentKey = 'uid';
        break;
      case 'RRULE':
        event.recurrence = value.trim();
        currentKey = 'recurrence';
        break;
      default:
        currentKey = '';
    }
  }
  
  return event;
}

// Enhanced calendar reading tool with date filtering
export const readCalendarTool = tool(
  async ({ timeRange = "next 7 days", userTimezone }) => {
    try {
      const config = getCalendarConfig();
      
      if (!config.caldavUrl || !config.email || !config.password) {
        return {
          success: false,
          error: "Calendar credentials not configured. Please set CALENDAR_CALDAV_URL, CALENDAR_EMAIL, and CALENDAR_PASSWORD environment variables.",
          events: [],
          count: 0
        };
      }

      if (!userTimezone) {
        return {
          success: false,
          error: "User timezone not specified. Please provide your timezone (e.g., 'America/New_York', 'Europe/London', 'Asia/Jakarta') for accurate calendar reading.",
          events: [],
          count: 0,
          requiresTimezone: true
        };
      }

      const client = await createDAVClient({
        serverUrl: config.caldavUrl,
        credentials: {
          username: config.email,
          password: config.password,
        },
        authMethod: config.authMethod,
        defaultAccountType: "caldav",
      });

      const calendars = await client.fetchCalendars();
      
      if (calendars.length === 0) {
        return {
          success: false,
          error: "No calendars found",
          events: [],
          count: 0
        };
      }

      const calendar = calendars[0];
      
      // Parse the time range to get start and end dates
      const { start: rangeStart, end: rangeEnd } = DateUtils.parseRelativeDate(timeRange);
      
      console.log("📅 Calendar query:", {
        timeRange,
        rangeStart: rangeStart.toISOString(),
        rangeEnd: rangeEnd.toISOString(),
        userTimezone
      });

      // Fetch calendar objects
      const calendarObjects = await client.fetchCalendarObjects({
        calendar,
        timeRange: {
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString()
        }
      });

      // Parse and filter events
      const events = calendarObjects
        .map(obj => {
          const parsedEvent = parseICalEvent(obj.data);
          
          if (!parsedEvent.start) {
            console.warn("⚠️ Event without start date:", parsedEvent.summary);
            return null;
          }
          
          return {
            summary: parsedEvent.summary || "No Title",
            description: parsedEvent.description || "",
            start: parsedEvent.start,
            end: parsedEvent.end || parsedEvent.start,
            location: parsedEvent.location || "",
            uid: parsedEvent.uid || "",
            recurrence: parsedEvent.recurrence || null,
            startLocal: DateUtils.formatDateForDisplay(parsedEvent.start, userTimezone),
            endLocal: parsedEvent.end ? DateUtils.formatDateForDisplay(parsedEvent.end, userTimezone) : null,
            etag: obj.etag,
            url: obj.url
          };
        })
        .filter(event => event !== null)
        .filter(event => {
          // Double-check events are within range
          const eventStart = new Date(event.start);
          return eventStart >= rangeStart && eventStart <= rangeEnd;
        })
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      // Group events by day
      const eventsByDay: Record<string, any[]> = {};
      events.forEach(event => {
        const dayKey = new Date(event.start).toLocaleDateString('en-US', {
          timeZone: userTimezone,
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        if (!eventsByDay[dayKey]) {
          eventsByDay[dayKey] = [];
        }
        eventsByDay[dayKey].push(event);
      });

      return {
        success: true,
        count: events.length,
        events,
        eventsByDay,
        timezone: userTimezone,
        queryRange: {
          start: rangeStart.toISOString(),
          end: rangeEnd.toISOString(),
          description: timeRange
        },
        provider: config.caldavUrl,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error("❌ Error reading calendar:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        events: [],
        count: 0,
        troubleshooting: [
          "Verify your CalDAV URL is correct",
          "Check your email and password credentials",
          "Ensure CalDAV access is enabled in your calendar provider",
          "Some providers require app-specific passwords for CalDAV access"
        ]
      };
    }
  },
  {
    name: "read_calendar",
    description: `Read calendar events for a specified time range.
    
    Examples of time ranges:
    - "today" - events for today only
    - "tomorrow" - events for tomorrow only  
    - "this week" - current week (Monday to Sunday)
    - "next week" - next week (Monday to Sunday)
    - "next 7 days" - next 7 days from today
    - "this month" - current month
    - "next month" - next month
    
    The tool automatically filters events within the specified range.`,
    schema: z.object({
      timeRange: z.string().default("next 7 days").describe("Time range to fetch events (e.g., 'today', 'tomorrow', 'this week', 'next week', 'next 7 days')"),
      userTimezone: z.string().describe("User's timezone (e.g., 'America/New_York', 'Europe/London', 'Asia/Jakarta') - REQUIRED"),
    }),
  }
);

// Check for calendar conflicts
export const checkCalendarConflictsTool = tool(
  async ({ startTime, endTime, userTimezone }) => {
    try {
      if (!userTimezone) {
        return {
          success: false,
          error: "User timezone not specified.",
          hasConflicts: false,
          conflicts: []
        };
      }

      // Parse the event times
      const referenceDate = new Date();
      const eventStart = parseDateTime(startTime, referenceDate, userTimezone);
      const eventEnd = parseDateTime(endTime, referenceDate, userTimezone);

      // Get the day of the event to check
      const dayString = eventStart.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });

      // Read calendar events for that day
      const calendarResponse = await readCalendarTool.invoke({
        timeRange: dayString,
        userTimezone
      });

      if (!calendarResponse.success) {
        return {
          success: false,
          error: calendarResponse.error,
          hasConflicts: false,
          conflicts: []
        };
      }

      // Check for conflicts
      const conflicts = calendarResponse.events.filter(event => {
        const existingStart = new Date(event.start);
        const existingEnd = new Date(event.end);
        return DateUtils.eventsOverlap(eventStart, eventEnd, existingStart, existingEnd);
      });

      return {
        success: true,
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts.map(event => ({
          summary: event.summary,
          start: event.startLocal,
          end: event.endLocal,
          uid: event.uid
        })),
        proposedEvent: {
          start: DateUtils.formatDateForDisplay(eventStart, userTimezone),
          end: DateUtils.formatDateForDisplay(eventEnd, userTimezone)
        }
      };

    } catch (error) {
      console.error("❌ Error checking conflicts:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        hasConflicts: false,
        conflicts: []
      };
    }
  },
  {
    name: "check_calendar_conflicts",
    description: "Check if a proposed time slot has conflicts with existing calendar events",
    schema: z.object({
      startTime: z.string().describe("Proposed event start time"),
      endTime: z.string().describe("Proposed event end time"),
      userTimezone: z.string().describe("User's timezone - REQUIRED"),
    }),
  }
);

// Enhanced event creation with conflict checking built-in
export const createCalendarEventTool = tool(
  async ({ summary, startTime, endTime, description = "", location = "", userTimezone, attendees = [], forceCreate = false }) => {
    try {
      const config = getCalendarConfig();
      
      if (!config.caldavUrl || !config.email || !config.password) {
        return {
          success: false,
          error: "Calendar credentials not configured."
        };
      }

      if (!userTimezone) {
        return {
          success: false,
          error: "User timezone not specified. Please provide your timezone.",
          requiresTimezone: true
        };
      }

      // Parse start and end times first
      const referenceDate = new Date();
      const eventStart = parseDateTime(startTime, referenceDate, userTimezone);
      const eventEnd = parseDateTime(endTime, referenceDate, userTimezone);
      
      // Validate times
      if (eventEnd <= eventStart) {
        return {
          success: false,
          error: "End time must be after start time"
        };
      }

      // Check for conflicts first (unless forced)
      if (!forceCreate) {
        console.log("🔍 Checking for calendar conflicts before creating event...");
        
        try {
          const conflictResult = await checkCalendarConflictsTool.invoke({
            startTime,
            endTime,
            userTimezone
          });

          if (conflictResult.success && conflictResult.hasConflicts) {
            const conflictList = conflictResult.conflicts.map((c: any) => 
              `- "${c.summary}" from ${c.start} to ${c.end}`
            ).join('\n');

            return {
              success: false,
              error: "Calendar conflict detected",
              hasConflicts: true,
              conflicts: conflictResult.conflicts,
              message: `⚠️ **Calendar Conflict Detected**

I found the following conflicting event(s) at the requested time:
${conflictList}

Your proposed event: "${summary}" from ${conflictResult.proposedEvent?.start} to ${conflictResult.proposedEvent?.end}

Would you like me to:
1. **Create anyway** (double-book the time slot) - say "create anyway" or "force create"
2. **Choose a different time** - suggest another time
3. **Cancel** the event creation

Please let me know how you'd like to proceed.`,
              proposedEvent: {
                summary,
                start: conflictResult.proposedEvent?.start,
                end: conflictResult.proposedEvent?.end
              }
            };
          }
        } catch (conflictError) {
          console.warn("⚠️ Conflict check failed, proceeding with creation:", conflictError);
        }
      }

      // Create client with retry logic
      let client;
      let retries = 3;
      while (retries > 0) {
        try {
          client = await createDAVClient({
            serverUrl: config.caldavUrl,
            credentials: {
              username: config.email,
              password: config.password,
            },
            authMethod: config.authMethod,
            defaultAccountType: "caldav",
          });
          break;
        } catch (error) {
          retries--;
          if (retries === 0) throw error;
          console.log(`⚠️ Connection failed, retrying... (${retries} attempts left)`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const calendars = await client!.fetchCalendars();
      
      if (calendars.length === 0) {
        return {
          success: false,
          error: "No calendars found"
        };
      }

      const calendar = calendars[0];
      
      // Generate unique UID
      const uid = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}@ai-calendar`;
      
      // Process attendees with validation to avoid example emails
      const validAttendees = attendees
        .map((email: string) => email.trim())
        .filter((email: string) => {
          // Validate email format
          if (!email || !email.includes('@')) return false;
          
          // Filter out example/placeholder emails to avoid hallucinations
          const lowerEmail = email.toLowerCase();
          const exampleDomains = ['example.com', 'example.org', 'test.com', 'domain.com', 'company.com', 'email.com'];
          const examplePatterns = ['john@', 'jane@', 'user@', 'test@', 'admin@', 'demo@'];
          
          // Check for example domains
          if (exampleDomains.some(domain => lowerEmail.endsWith(domain))) return false;
          
          // Check for example patterns
          if (examplePatterns.some(pattern => lowerEmail.startsWith(pattern))) return false;
          
          return true;
        });
      
      // Create attendee lines for iCalendar
      const attendeeLines = validAttendees.map((email: string) => 
        `ATTENDEE;CN=${email};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`
      );
      
      // Create iCalendar event
      const eventData = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AI Calendar Tool//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `ORGANIZER;CN=${config.email}:mailto:${config.email}`,
        `SUMMARY:${escapeICalString(summary)}`,
        `DTSTART:${formatICalDate(eventStart)}`,
        `DTEND:${formatICalDate(eventEnd)}`,
        ...(description ? [`DESCRIPTION:${escapeICalString(description)}`] : []),
        ...(location ? [`LOCATION:${escapeICalString(location)}`] : []),
        ...attendeeLines,
        "STATUS:CONFIRMED",
        `DTSTAMP:${formatICalDate(new Date())}`,
        `CREATED:${formatICalDate(new Date())}`,
        `LAST-MODIFIED:${formatICalDate(new Date())}`,
        "END:VEVENT",
        "END:VCALENDAR",
      ].join('\r\n');

      await client!.createCalendarObject({
        calendar,
        filename: `${uid}.ics`,
        iCalString: eventData,
      });

      return {
        success: true,
        message: `Event "${summary}" created successfully${forceCreate ? ' (forced creation with conflicts)' : ''}${validAttendees.length > 0 ? ` with ${validAttendees.length} attendee(s)` : ''}`,
        event: {
          uid,
          summary,
          startTime: DateUtils.formatDateForDisplay(eventStart, userTimezone),
          endTime: DateUtils.formatDateForDisplay(eventEnd, userTimezone),
          description,
          location,
          attendees: validAttendees,
          timezone: userTimezone,
        },
        provider: config.caldavUrl,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error("❌ Error creating calendar event:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        troubleshooting: [
          "Ensure your calendar provider allows event creation via CalDAV",
          "Check if you have write permissions to the calendar",
          "Some providers require specific calendar URLs for writing"
        ]
      };
    }
  },
  {
    name: "create_calendar_event",
    description: `Create a new calendar event with automatic conflict checking. Supports natural language for dates and times.
    
    Examples:
    - "tomorrow at 2 PM" 
    - "next Monday 10:30 AM"
    - "June 15 at 3:00 PM"
    - "2025-07-01T14:00:00"
    
    The tool automatically checks for conflicts before creating events.
    If conflicts are found, you'll be asked to confirm or choose a different time.
    Always specify both start and end times.`,
    schema: z.object({
      summary: z.string().min(1).describe("Event title/summary (required)"),
      startTime: z.string().describe("Event start time (natural language or ISO format)"),
      endTime: z.string().describe("Event end time (natural language or ISO format)"),
      description: z.string().optional().default("").describe("Event description (optional)"),
      location: z.string().optional().default("").describe("Event location (optional)"),
      attendees: z.array(z.string().email()).optional().default([]).describe("Array of attendee email addresses (optional)"),
      userTimezone: z.string().describe("User's timezone (e.g., 'America/New_York') - REQUIRED"),
      forceCreate: z.boolean().optional().default(false).describe("Force creation even if conflicts exist"),
    }),
  }
);

// Delete calendar event tool
export const deleteCalendarEventTool = tool(
  async ({ eventIdentifier, userTimezone }) => {
    try {
      const config = getCalendarConfig();
      
      if (!config.caldavUrl || !config.email || !config.password) {
        return {
          success: false,
          error: "Calendar credentials not configured."
        };
      }

      if (!userTimezone) {
        return {
          success: false,
          error: "User timezone not specified.",
          requiresTimezone: true
        };
      }

      const client = await createDAVClient({
        serverUrl: config.caldavUrl,
        credentials: {
          username: config.email,
          password: config.password,
        },
        authMethod: config.authMethod,
        defaultAccountType: "caldav",
      });

      const calendars = await client.fetchCalendars();
      
      if (calendars.length === 0) {
        return {
          success: false,
          error: "No calendars found"
        };
      }

      const calendar = calendars[0];
      
      // First, fetch all events to find the one to delete
      const calendarObjects = await client.fetchCalendarObjects({
        calendar,
      });

      // Find the event by UID or summary
      let eventToDelete = null;
      let eventUrl = null;
      
      for (const obj of calendarObjects) {
        const parsedEvent = parseICalEvent(obj.data);
        
        // Check if this is the event we want to delete
        if (parsedEvent.uid === eventIdentifier || 
            parsedEvent.summary?.toLowerCase().includes(eventIdentifier.toLowerCase())) {
          eventToDelete = parsedEvent;
          eventUrl = obj.url;
          break;
        }
      }

      if (!eventToDelete || !eventUrl) {
        return {
          success: false,
          error: `Event "${eventIdentifier}" not found. Please provide the exact event UID or a unique part of the event title.`,
          suggestion: "Try using 'read_calendar' to list events and find the correct identifier."
        };
      }

      // Delete the event
      await client.deleteCalendarObject({
        calendarObject: {
          url: eventUrl,
          etag: '', // Some servers don't require etag for deletion
        }
      });

      return {
        success: true,
        message: `Event "${eventToDelete.summary}" deleted successfully`,
        deletedEvent: {
          summary: eventToDelete.summary,
          start: eventToDelete.start ? DateUtils.formatDateForDisplay(eventToDelete.start, userTimezone) : 'N/A',
          uid: eventToDelete.uid
        },
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error("❌ Error deleting calendar event:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        troubleshooting: [
          "Ensure you have permission to delete events",
          "Some calendar providers may not support deletion via CalDAV",
          "Try refreshing your calendar view after deletion"
        ]
      };
    }
  },
  {
    name: "delete_calendar_event",
    description: `Delete a calendar event by its UID or title.
    
    To delete an event, provide either:
    - The event UID (unique identifier)
    - A unique part of the event title/summary
    
    Use 'read_calendar' first to find the event you want to delete.`,
    schema: z.object({
      eventIdentifier: z.string().describe("Event UID or unique part of the event title"),
      userTimezone: z.string().describe("User's timezone - REQUIRED"),
    }),
  }
);

// Test calendar connection tool (unchanged but with better error messages)
export const testCalendarConnectionTool = tool(
  async ({}) => {
    try {
      const config = getCalendarConfig();
      
      if (!config.caldavUrl || !config.email || !config.password) {
        return {
          success: false,
          error: "Calendar credentials not configured",
          details: {
            CALENDAR_CALDAV_URL: config.caldavUrl ? "✅ Set" : "❌ Missing",
            CALENDAR_EMAIL: config.email ? "✅ Set" : "❌ Missing", 
            CALENDAR_PASSWORD: config.password ? "✅ Set" : "❌ Missing",
          },
          setup: "Please set the required environment variables to use calendar features."
        };
      }

      console.log("🔧 Testing calendar connection...");
      
      const client = await createDAVClient({
        serverUrl: config.caldavUrl,
        credentials: {
          username: config.email,
          password: config.password,
        },
        authMethod: config.authMethod,
        defaultAccountType: "caldav",
      });

      const calendars = await client.fetchCalendars();

      return {
        success: true,
        message: "Calendar connection successful!",
        config: {
          caldavUrl: config.caldavUrl,
          email: config.email,
          authMethod: config.authMethod,
          calendarsFound: calendars.length,
        },
        calendars: calendars.map(cal => ({
          displayName: cal.displayName || "Default Calendar",
          url: cal.url,
        })),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error("❌ Calendar connection test failed:", error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const isAuthError = errorMessage.toLowerCase().includes('auth') || 
                         errorMessage.toLowerCase().includes('401') ||
                         errorMessage.toLowerCase().includes('credentials');
      
      return {
        success: false,
        error: errorMessage,
        troubleshooting: isAuthError ? [
          "Authentication failed - check your credentials",
          "For Google: Use an app-specific password, not your regular password",
          "For iCloud: Use an app-specific password from appleid.apple.com",
          "For Outlook: Enable basic authentication or use an app password",
          "Ensure Two-Factor Authentication is properly configured"
        ] : [
          "Verify your CalDAV URL is correct and accessible",
          "Common CalDAV URLs:",
          "  - Google: https://www.google.com/calendar/dav/",
          "  - iCloud: https://caldav.icloud.com/",
          "  - Outlook: https://outlook.office365.com/",
          "Check network connectivity and firewall settings",
          "Try accessing the CalDAV URL in a browser"
        ],
        timestamp: new Date().toISOString()
      };
    }
  },
  {
    name: "test_calendar_connection",
    description: "Test calendar server connection and configuration. Use this to debug calendar issues.",
    schema: z.object({}),
  }
);

// Force create calendar event tool (for overriding conflicts)
export const forceCreateCalendarEventTool = tool(
  async ({ summary, startTime, endTime, description = "", location = "", attendees = [], userTimezone }) => {
    // Simply call the main create tool with forceCreate = true
    return await createCalendarEventTool.invoke({
      summary,
      startTime,
      endTime,
      description,
      location,
      attendees,
      userTimezone,
      forceCreate: true
    });
  },
  {
    name: "force_create_calendar_event",
    description: "Force create a calendar event even if there are conflicts (double-book the time slot). Use this when the user explicitly wants to override conflicts.",
    schema: z.object({
      summary: z.string().min(1).describe("Event title/summary (required)"),
      startTime: z.string().describe("Event start time (natural language or ISO format)"),
      endTime: z.string().describe("Event end time (natural language or ISO format)"),
      description: z.string().optional().default("").describe("Event description (optional)"),
      location: z.string().optional().default("").describe("Event location (optional)"),
      attendees: z.array(z.string().email()).optional().default([]).describe("Array of attendee email addresses (optional)"),
      userTimezone: z.string().describe("User's timezone (e.g., 'America/New_York') - REQUIRED"),
    }),
  }
);

// Helper functions
function parseDateTime(input: string, referenceDate: Date, userTimezone: string): Date {
  const lowerInput = input.toLowerCase().trim();
  
  // Handle relative times
  if (lowerInput.includes('tomorrow')) {
    const tomorrow = new Date(referenceDate);
    tomorrow.setDate(referenceDate.getDate() + 1);
    
    // Extract time if present
    const timeMatch = input.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3]?.toLowerCase() === 'pm';
      
      let finalHours = hours;
      if (isPM && hours !== 12) finalHours += 12;
      else if (!isPM && hours === 12) finalHours = 0;
      
      tomorrow.setHours(finalHours, minutes, 0, 0);
    }
    return tomorrow;
  }
  
  // Handle "next [day]" format
  const nextDayMatch = lowerInput.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (nextDayMatch) {
    const targetDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      .indexOf(nextDayMatch[1]);
    
    const result = new Date(referenceDate);
    const currentDay = result.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntilTarget);
    
    // Extract time if present
    const timeMatch = input.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const isPM = timeMatch[3]?.toLowerCase() === 'pm';
      
      let finalHours = hours;
      if (isPM && hours !== 12) finalHours += 12;
      else if (!isPM && hours === 12) finalHours = 0;
      
      result.setHours(finalHours, minutes, 0, 0);
    }
    return result;
  }
  
  // Try standard parsing
  const parsed = new Date(input);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  // Default to reference date
  return referenceDate;
}

function formatICalDate(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeICalString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}