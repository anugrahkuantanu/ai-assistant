# AI Agent Tools Configuration

This document explains how to configure the email and calendar tools for the AI agent.

## Overview

The AI agent now supports generic email and calendar tools that work with multiple providers through standard protocols:
- **Email Tools**: Support any IMAP/SMTP provider
- **Calendar Tools**: Support any CalDAV provider

## Environment Variables

### Generic Email Configuration

```bash
# Required: Email credentials
EMAIL_ADDRESS=your_email@example.com
EMAIL_PASSWORD=your_password_or_app_password

# Optional: Server settings (defaults shown for One.com)
EMAIL_IMAP_HOST=imap.one.com          # IMAP server for reading emails
EMAIL_IMAP_PORT=993                   # IMAP port (usually 993 for SSL)
EMAIL_SMTP_HOST=send.one.com          # SMTP server for sending emails  
EMAIL_SMTP_PORT=465                   # SMTP port (465 for SSL, 587 for TLS)
EMAIL_SECURE=true                     # Use SSL/TLS (true/false)
```

### Generic Calendar Configuration

```bash
# Required: CalDAV URL and credentials
CALENDAR_CALDAV_URL=https://caldav.one.com/calendars/users/your_email@example.com/calendar
CALENDAR_EMAIL=your_email@example.com     # Optional: uses EMAIL_ADDRESS if not set
CALENDAR_PASSWORD=your_password           # Optional: uses EMAIL_PASSWORD if not set
CALENDAR_AUTH_METHOD=Basic                # Basic or Digest authentication
```

## Provider-Specific Examples

### One.com (Default)
```bash
EMAIL_IMAP_HOST=imap.one.com
EMAIL_SMTP_HOST=send.one.com
CALENDAR_CALDAV_URL=https://caldav.one.com/calendars/users/your_email@one.com/calendar
```

### Gmail
```bash
EMAIL_IMAP_HOST=imap.gmail.com
EMAIL_IMAP_PORT=993
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
CALENDAR_CALDAV_URL=https://apidata.googleusercontent.com/caldav/v2/your_email@gmail.com/events
```

### Outlook/Hotmail
```bash
EMAIL_IMAP_HOST=outlook.office365.com
EMAIL_SMTP_HOST=smtp.office365.com
CALENDAR_CALDAV_URL=https://outlook.office365.com/caldav/your_email@outlook.com/calendar
```

### Yahoo
```bash
EMAIL_IMAP_HOST=imap.mail.yahoo.com
EMAIL_SMTP_HOST=smtp.mail.yahoo.com
# Yahoo doesn't support CalDAV directly
```

## Available Tools

### Email Tools

1. **read_emails**
   - Read recent emails from inbox
   - Returns structured JSON with success flag
   - AI automatically formats results for user

2. **send_email** 
   - Send emails with optional HTML content
   - Validates email addresses
   - Supports priority levels (low, normal, high)
   - AI asks for confirmation on important emails

3. **test_email_connection**
   - Debug email server connectivity
   - Provides troubleshooting steps
   - Shows configuration status

### Calendar Tools

1. **read_calendar**
   - Read upcoming events
   - **Requires user timezone** (e.g., 'America/New_York', 'Europe/London', 'Asia/Jakarta')
   - Supports relative dates with current date reference
   - Converts times to user's local timezone

2. **create_calendar_event**
   - Create new calendar events
   - **Requires user timezone**
   - Parses relative dates like "tomorrow 2 PM"
   - Validates time ranges
   - AI asks for confirmation

3. **test_calendar_connection**
   - Debug CalDAV connectivity
   - Lists available calendars
   - Shows configuration status

## AI-Friendly Features

### Structured JSON Responses
All tools return consistent JSON responses with:
- `success`: boolean flag
- `error`: error message if failed
- `timestamp`: operation timestamp
- Tool-specific data fields

### Timezone Intelligence
- Calendar tools require user timezone for accuracy
- AI automatically asks for timezone if not provided
- All times converted to user's local timezone
- Supports relative date parsing ("tomorrow", "next week")

### Current Date Reference
- System message includes current date/time
- AI uses this for relative date calculations
- Consistent date handling across all operations

### Error Handling
- Comprehensive error messages
- Troubleshooting guidance
- Graceful fallbacks for missing configuration

### Validation
- Email address format validation
- Time range validation for events
- Configuration completeness checks

## Migration from One.com Tools

If you were using the old One.com specific tools, update your environment variables:

```bash
# Old (deprecated)
ONECOM_EMAIL=your_email@one.com
ONECOM_PASSWORD=your_password

# New (generic)
EMAIL_ADDRESS=your_email@one.com
EMAIL_PASSWORD=your_password
CALENDAR_CALDAV_URL=https://caldav.one.com/calendars/users/your_email@one.com/calendar
```

## Troubleshooting

### Email Issues
1. Verify IMAP/SMTP settings with your provider
2. Enable "Less secure app access" or use app passwords
3. Check firewall/network restrictions
4. Use `test_email_connection` tool for debugging

### Calendar Issues  
1. Verify CalDAV URL format with your provider
2. Enable CalDAV access in account settings
3. Check authentication method (Basic vs Digest)
4. Use `test_calendar_connection` tool for debugging

### Common Provider Requirements
- **Gmail**: Requires app passwords with 2FA enabled
- **Outlook**: May require modern authentication setup
- **Yahoo**: Requires app passwords, limited CalDAV support
- **One.com**: Works with regular passwords

## Security Notes

- Store credentials in environment variables, never in code
- Use app passwords when available (more secure than account passwords)
- Enable 2FA on email accounts when possible
- Regularly rotate passwords and app passwords 