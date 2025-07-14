import type { Tool } from "@modelcontextprotocol/sdk/types.js";
declare function readCalendar({ timeRange, userTimezone, caldavUrl, email, password, authMethod }: {
    timeRange?: string;
    userTimezone: string;
    caldavUrl: string;
    email: string;
    password: string;
    authMethod?: "Basic" | "Digest";
}): Promise<{
    success: boolean;
    error: string;
    events: never[];
    count: number;
    requiresTimezone?: never;
    eventsByDay?: never;
    timezone?: never;
    queryRange?: never;
    provider?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    events: never[];
    count: number;
    requiresTimezone: boolean;
    eventsByDay?: never;
    timezone?: never;
    queryRange?: never;
    provider?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    count: number;
    events: {
        summary: any;
        description: any;
        start: any;
        end: any;
        location: any;
        uid: any;
        recurrence: any;
        startLocal: string;
        endLocal: string | null;
        etag: string | undefined;
        url: string;
    }[];
    eventsByDay: Record<string, any[]>;
    timezone: string;
    queryRange: {
        start: string;
        end: string;
        description: string;
    };
    provider: string;
    timestamp: string;
    error?: never;
    requiresTimezone?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    events: never[];
    count: number;
    troubleshooting: string[];
    requiresTimezone?: never;
    eventsByDay?: never;
    timezone?: never;
    queryRange?: never;
    provider?: never;
    timestamp?: never;
}>;
declare function checkCalendarConflicts({ startTime, endTime, userTimezone, caldavUrl, email, password, authMethod }: {
    startTime: string;
    endTime: string;
    userTimezone: string;
    caldavUrl: string;
    email: string;
    password: string;
    authMethod?: "Basic" | "Digest";
}): Promise<{
    success: boolean;
    error: string | undefined;
    hasConflicts: boolean;
    conflicts: never[];
    proposedEvent?: never;
} | {
    success: boolean;
    hasConflicts: boolean;
    conflicts: {
        summary: any;
        start: string;
        end: string | null;
        uid: any;
    }[];
    proposedEvent: {
        start: string;
        end: string;
    };
    error?: never;
}>;
declare function createCalendarEvent({ summary, startTime, endTime, description, location, userTimezone, attendees, forceCreate, caldavUrl, email, password, authMethod }: {
    summary: string;
    startTime: string;
    endTime: string;
    description?: string;
    location?: string;
    userTimezone: string;
    attendees?: string[];
    forceCreate?: boolean;
    caldavUrl: string;
    email: string;
    password: string;
    authMethod?: "Basic" | "Digest";
}): Promise<{
    success: boolean;
    error: string;
    requiresTimezone?: never;
    hasConflicts?: never;
    conflicts?: never;
    message?: never;
    proposedEvent?: never;
    event?: never;
    provider?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    requiresTimezone: boolean;
    hasConflicts?: never;
    conflicts?: never;
    message?: never;
    proposedEvent?: never;
    event?: never;
    provider?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    hasConflicts: boolean;
    conflicts: never[] | {
        summary: any;
        start: string;
        end: string | null;
        uid: any;
    }[];
    message: string;
    proposedEvent: {
        summary: string;
        start: string | undefined;
        end: string | undefined;
    };
    requiresTimezone?: never;
    event?: never;
    provider?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    message: string;
    event: {
        uid: string;
        summary: string;
        startTime: string;
        endTime: string;
        description: string;
        location: string;
        attendees: string[];
        timezone: string;
    };
    provider: string;
    timestamp: string;
    error?: never;
    requiresTimezone?: never;
    hasConflicts?: never;
    conflicts?: never;
    proposedEvent?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    troubleshooting: string[];
    requiresTimezone?: never;
    hasConflicts?: never;
    conflicts?: never;
    message?: never;
    proposedEvent?: never;
    event?: never;
    provider?: never;
    timestamp?: never;
}>;
declare function deleteCalendarEvent({ eventIdentifier, userTimezone, caldavUrl, email, password, authMethod }: {
    eventIdentifier: string;
    userTimezone: string;
    caldavUrl: string;
    email: string;
    password: string;
    authMethod?: "Basic" | "Digest";
}): Promise<{
    success: boolean;
    error: string;
    requiresTimezone?: never;
    suggestion?: never;
    message?: never;
    deletedEvent?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    requiresTimezone: boolean;
    suggestion?: never;
    message?: never;
    deletedEvent?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    suggestion: string;
    requiresTimezone?: never;
    message?: never;
    deletedEvent?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    message: string;
    deletedEvent: {
        summary: any;
        start: string;
        uid: any;
    };
    timestamp: string;
    error?: never;
    requiresTimezone?: never;
    suggestion?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    troubleshooting: string[];
    requiresTimezone?: never;
    suggestion?: never;
    message?: never;
    deletedEvent?: never;
    timestamp?: never;
}>;
declare function testCalendarConnection({ caldavUrl, email, password, authMethod }: {
    caldavUrl: string;
    email: string;
    password: string;
    authMethod?: "Basic" | "Digest";
}): Promise<{
    success: boolean;
    error: string;
    details: {
        caldavUrl: string;
        email: string;
        password: string;
    };
    message?: never;
    config?: never;
    calendars?: never;
    timestamp?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    message: string;
    config: {
        caldavUrl: string;
        email: string;
        authMethod: "Basic" | "Digest";
        calendarsFound: number;
    };
    calendars: {
        displayName: string | Record<string, unknown>;
        url: string;
    }[];
    timestamp: string;
    error?: never;
    details?: never;
    troubleshooting?: never;
} | {
    success: boolean;
    error: string;
    troubleshooting: string[];
    timestamp: string;
    details?: never;
    message?: never;
    config?: never;
    calendars?: never;
}>;
export declare const calendarTools: Tool[];
export declare function handleCalendarTool(name: string, args: any): Promise<any>;
export { readCalendar, checkCalendarConflicts, createCalendarEvent, deleteCalendarEvent, testCalendarConnection };
//# sourceMappingURL=schedule.d.ts.map