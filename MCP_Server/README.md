# Unified MCP Server

A comprehensive Model Context Protocol (MCP) server that provides email and calendar management tools for AI agents.

## Features

### 📧 Email Tools
- **read_emails**: Read recent emails from IMAP servers
- **send_email**: Send emails via SMTP with attachments support
- **test_email_connection**: Test email server connectivity

### 📅 Calendar Tools  
- **read_calendar**: Read calendar events with flexible time ranges
- **create_calendar_event**: Create new calendar events with conflict detection
- **force_create_calendar_event**: Force create events even with conflicts
- **check_calendar_conflicts**: Check for scheduling conflicts
- **delete_calendar_event**: Delete calendar events by UID or title
- **test_calendar_connection**: Test CalDAV server connectivity

## Prerequisites

- Node.js 18.0.0 or higher
- TypeScript 5.x
- Email account with IMAP/SMTP access
- CalDAV-compatible calendar service (Google Calendar, iCloud, Outlook, etc.)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd MCP_Server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

**⚠️ IMPORTANT: This MCP server requires NO server-side configuration or environment variables!**

All credentials and settings must be provided by the client application on each tool call. This ensures:
- **Scalability**: Each client can use their own email/calendar accounts
- **Security**: No credentials stored on the server
- **Flexibility**: Different clients can use different providers simultaneously

### Provider-Specific Settings (Client-Side)

When calling the MCP tools, you'll need to provide the appropriate settings for your email/calendar provider:

#### Google (Gmail/Calendar)
```javascript
{
  // Email settings
  email: "your-email@gmail.com",
  password: "your-app-password",
  imapHost: "imap.gmail.com",
  imapPort: 993,
  smtpHost: "smtp.gmail.com", 
  smtpPort: 465,
  secure: true,
  
  // Calendar settings
  caldavUrl: "https://www.google.com/calendar/dav/",
  authMethod: "Basic"
}
```
**Note**: Use App Passwords, not your regular password!

#### iCloud
```javascript
{
  // Email settings
  email: "your-email@me.com",
  password: "your-app-password",
  imapHost: "imap.mail.me.com",
  imapPort: 993,
  smtpHost: "smtp.mail.me.com",
  smtpPort: 587,
  secure: true,
  
  // Calendar settings
  caldavUrl: "https://caldav.icloud.com/",
  authMethod: "Basic"
}
```

#### Outlook/Office365
```javascript
{
  // Email settings
  email: "your-email@outlook.com",
  password: "your-password",
  imapHost: "outlook.office365.com",
  imapPort: 993,
  smtpHost: "smtp.office365.com",
  smtpPort: 587,
  secure: true,
  
  // Calendar settings
  caldavUrl: "https://outlook.office365.com/",
  authMethod: "Basic"
}
```

## Running the Server

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

### Using the Inspector (for testing)
```bash
npm run inspector
```

## Client-Side Integration (AI Agent)

### 1. MCP Client Setup

In your AI agent, you need to configure the MCP client to connect to this server. Here's how:

#### Installing MCP SDK in your AI agent:
```bash
npm install @modelcontextprotocol/sdk
```

#### Basic Client Configuration:
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// Create MCP client
const client = new Client(
  {
    name: "my-ai-agent",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Connect to the MCP server
const transport = new StdioClientTransport({
  command: "node",
  args: ["/path/to/MCP_Server/dist/index.js"],
});

await client.connect(transport);
```

### 2. Listing Available Tools

```typescript
// Get all available tools
const toolsResult = await client.request({
  method: "tools/list",
  params: {}
});

console.log("Available tools:", toolsResult.tools);
```

### 3. Using Email Tools

#### Reading Emails
```typescript
const emailsResult = await client.request({
  method: "tools/call",
  params: {
    name: "read_emails",
    arguments: {
      limit: 10,  // Optional: number of emails to fetch
      email: "your-email@gmail.com",
      password: "your-app-password",
      imapHost: "imap.gmail.com",
      imapPort: 993,
      secure: true
    }
  }
});

console.log("Recent emails:", emailsResult.content[0].text);
```

#### Sending Emails
```typescript
const sendResult = await client.request({
  method: "tools/call",
  params: {
    name: "send_email",
    arguments: {
      to: "recipient@example.com",
      subject: "Hello from AI Agent",
      body: "This email was sent by my AI agent!",
      priority: "normal",  // Optional: "low", "normal", "high"
      email: "your-email@gmail.com",
      password: "your-app-password",
      smtpHost: "smtp.gmail.com",
      smtpPort: 465,
      secure: true
    }
  }
});

console.log("Email sent:", sendResult.content[0].text);
```

### 4. Using Calendar Tools

#### Reading Calendar Events
```typescript
const calendarResult = await client.request({
  method: "tools/call", 
  params: {
    name: "read_calendar",
    arguments: {
      timeRange: "next 7 days",  // "today", "tomorrow", "this week", etc.
      userTimezone: "America/New_York",  // Required!
      caldavUrl: "https://www.google.com/calendar/dav/",
      email: "your-email@gmail.com",
      password: "your-app-password",
      authMethod: "Basic"
    }
  }
});

console.log("Calendar events:", calendarResult.content[0].text);
```

#### Creating Calendar Events
```typescript
const createEventResult = await client.request({
  method: "tools/call",
  params: {
    name: "create_calendar_event", 
    arguments: {
      summary: "Meeting with AI Agent",
      startTime: "tomorrow at 2 PM",
      endTime: "tomorrow at 3 PM", 
      description: "Discussing AI integration",
      location: "Conference Room A",
      userTimezone: "America/New_York",
      attendees: ["colleague@example.com"],  // Optional
      caldavUrl: "https://www.google.com/calendar/dav/",
      email: "your-email@gmail.com",
      password: "your-app-password",
      authMethod: "Basic"
    }
  }
});

console.log("Event created:", createEventResult.content[0].text);
```

### 5. Error Handling

```typescript
try {
  const result = await client.request({
    method: "tools/call",
    params: {
      name: "send_email",
      arguments: {
        to: "invalid-email",
        subject: "Test",
        body: "Test message"
      }
    }
  });
} catch (error) {
  console.error("MCP tool error:", error);
  
  // Parse the error response
  if (error.message.includes("Invalid recipient")) {
    console.log("Please provide a valid email address");
  }
}
```

### 6. Complete Example: AI Agent Integration

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

class AIAgent {
  private mcpClient: Client;
  
  async initialize() {
    this.mcpClient = new Client(
      { name: "ai-agent", version: "1.0.0" },
      { capabilities: { tools: {} } }
    );
    
    const transport = new StdioClientTransport({
      command: "node",
      args: ["/path/to/MCP_Server/dist/index.js"],
    });
    
    await this.mcpClient.connect(transport);
    console.log("✅ Connected to MCP server");
  }
  
  async checkEmails() {
    try {
      const result = await this.mcpClient.request({
        method: "tools/call",
        params: {
          name: "read_emails",
          arguments: { limit: 5 }
        }
      });
      
      const emails = JSON.parse(result.content[0].text);
      console.log(`📧 Found ${emails.count} recent emails`);
      return emails;
    } catch (error) {
      console.error("❌ Failed to read emails:", error);
    }
  }
  
  async scheduleMeeting(title: string, startTime: string, endTime: string) {
    try {
      const result = await this.mcpClient.request({
        method: "tools/call",
        params: {
          name: "create_calendar_event",
          arguments: {
            summary: title,
            startTime,
            endTime,
            userTimezone: "America/New_York"
          }
        }
      });
      
      const response = JSON.parse(result.content[0].text);
      if (response.success) {
        console.log(`📅 Meeting "${title}" scheduled successfully`);
      } else {
        console.log(`⚠️ Scheduling conflict: ${response.message}`);
      }
      return response;
    } catch (error) {
      console.error("❌ Failed to schedule meeting:", error);
    }
  }
}

// Usage
const agent = new AIAgent();
await agent.initialize();
await agent.checkEmails();
await agent.scheduleMe
```

## Testing the Server

### 1. Manual Testing with MCP Inspector

1. Start the inspector: `npm run inspector`
2. Open your browser to the provided URL
3. Test individual tools by providing credentials in the tool arguments:

#### Test Email Connection
```json
{
  "email": "your-email@gmail.com",
  "password": "your-app-password",
  "smtpHost": "smtp.gmail.com",
  "smtpPort": 465,
  "secure": true
}
```

#### Test Calendar Connection
```json
{
  "caldavUrl": "https://www.google.com/calendar/dav/",
  "email": "your-email@gmail.com",
  "password": "your-app-password",
  "authMethod": "Basic"
}
```

#### Read Emails
```json
{
  "limit": 5,
  "email": "your-email@gmail.com",
  "password": "your-app-password",
  "imapHost": "imap.gmail.com",
  "imapPort": 993,
  "secure": true
}
```

#### Read Calendar
```json
{
  "timeRange": "today",
  "userTimezone": "America/New_York",
  "caldavUrl": "https://www.google.com/calendar/dav/",
  "email": "your-email@gmail.com",
  "password": "your-app-password",
  "authMethod": "Basic"
}
```

## Troubleshooting

### Email Issues
- **Authentication Failed**: Use app-specific passwords for Gmail/iCloud
- **Connection Timeout**: Check firewall settings and SMTP/IMAP ports
- **Invalid Credentials**: Verify email and password in tool arguments
- **Missing Required Parameters**: Ensure all required credentials are provided

### Calendar Issues  
- **CalDAV Connection Failed**: Verify caldavUrl is correct in tool arguments
- **Authentication Error**: Use app-specific passwords
- **No Calendars Found**: Ensure calendar access is enabled
- **Missing Credentials**: Ensure all required calendar parameters are provided

### General Issues
- **Module Not Found**: Run `npm install` and `npm run build`
- **Permission Denied**: Check file permissions on dist/index.js
- **Port Issues**: Ensure no other MCP servers are running

## Security Considerations

1. **Client-Side Security**: All credentials are provided by the client - ensure your client application securely handles and stores credentials
2. **No Server-Side Storage**: This server does not store any credentials or configuration
3. **Use App-Specific Passwords**: Always use app-specific passwords instead of main account passwords
4. **Transport Security**: Credentials are passed through the MCP protocol - ensure your client-server communication is secure
5. **Credential Rotation**: Regularly rotate passwords and API keys in your client applications
6. **Audit Trail**: Consider logging credential usage in your client applications for security auditing

## API Documentation

### Email Tools

#### `read_emails`
- **Purpose**: Read recent emails from IMAP server
- **Parameters**:
  - `limit` (optional): Number of emails to fetch (1-50, default: 10)
  - `email` (required): Email address for authentication
  - `password` (required): Email password or app-specific password
  - `imapHost` (required): IMAP server hostname (e.g., 'imap.gmail.com')
  - `imapPort` (optional): IMAP server port (default: 993)
  - `secure` (optional): Use SSL/TLS connection (default: true)
- **Returns**: Email list with subject, sender, date, body preview

#### `send_email`
- **Purpose**: Send email via SMTP
- **Parameters**:
  - `to` (required): Recipient email address
  - `subject` (required): Email subject
  - `body` (required): Email body (plain text)
  - `htmlBody` (optional): HTML version of email
  - `priority` (optional): "low", "normal", "high"
  - `email` (required): Sender email address for authentication
  - `password` (required): Email password or app-specific password
  - `smtpHost` (required): SMTP server hostname (e.g., 'smtp.gmail.com')
  - `smtpPort` (optional): SMTP server port (default: 465)
  - `secure` (optional): Use SSL/TLS connection (default: true)
- **Returns**: Delivery confirmation with message ID

#### `test_email_connection`
- **Purpose**: Test email server connection with provided credentials
- **Parameters**:
  - `email` (required): Email address for authentication
  - `password` (required): Email password or app-specific password
  - `smtpHost` (required): SMTP server hostname
  - `smtpPort` (optional): SMTP server port (default: 465)
  - `secure` (optional): Use SSL/TLS connection (default: true)
- **Returns**: Connection test results

### Calendar Tools

#### `read_calendar`
- **Purpose**: Read calendar events for specified time range
- **Parameters**:
  - `timeRange` (optional): "today", "tomorrow", "this week", "next 7 days", etc.
  - `userTimezone` (required): User's timezone (e.g., "America/New_York")
  - `caldavUrl` (required): CalDAV server URL (e.g., 'https://www.google.com/calendar/dav/')
  - `email` (required): Email address for authentication
  - `password` (required): Password or app-specific password
  - `authMethod` (optional): Authentication method ("Basic" or "Digest", default: "Basic")
- **Returns**: List of events with details and timezone conversion

#### `create_calendar_event`
- **Purpose**: Create new calendar event with conflict checking
- **Parameters**:
  - `summary` (required): Event title
  - `startTime` (required): Start time (natural language or ISO format)
  - `endTime` (required): End time
  - `description` (optional): Event description
  - `location` (optional): Event location
  - `userTimezone` (required): User's timezone
  - `attendees` (optional): Array of email addresses
  - `forceCreate` (optional): Create even if conflicts exist
  - `caldavUrl` (required): CalDAV server URL
  - `email` (required): Email address for authentication
  - `password` (required): Password or app-specific password
  - `authMethod` (optional): Authentication method (default: "Basic")
- **Returns**: Event creation confirmation or conflict details

#### `check_calendar_conflicts`
- **Purpose**: Check if a proposed time slot has conflicts with existing events
- **Parameters**:
  - `startTime` (required): Proposed event start time
  - `endTime` (required): Proposed event end time
  - `userTimezone` (required): User's timezone
  - `caldavUrl` (required): CalDAV server URL
  - `email` (required): Email address for authentication
  - `password` (required): Password or app-specific password
  - `authMethod` (optional): Authentication method (default: "Basic")
- **Returns**: Conflict detection results

#### `delete_calendar_event`
- **Purpose**: Delete a calendar event by UID or title
- **Parameters**:
  - `eventIdentifier` (required): Event UID or unique part of event title
  - `userTimezone` (required): User's timezone
  - `caldavUrl` (required): CalDAV server URL
  - `email` (required): Email address for authentication
  - `password` (required): Password or app-specific password
  - `authMethod` (optional): Authentication method (default: "Basic")
- **Returns**: Deletion confirmation

#### `test_calendar_connection`
- **Purpose**: Test calendar server connection with provided credentials
- **Parameters**:
  - `caldavUrl` (required): CalDAV server URL
  - `email` (required): Email address for authentication
  - `password` (required): Password or app-specific password
  - `authMethod` (optional): Authentication method (default: "Basic")
- **Returns**: Connection test results

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.