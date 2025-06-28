import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

// Email configuration schema for validation
const EmailConfigSchema = z.object({
  imapHost: z.string(),
  imapPort: z.number(),
  smtpHost: z.string(),
  smtpPort: z.number(),
  email: z.string().email(),
  password: z.string(),
  secure: z.boolean().optional().default(true),
});

// Get email configuration from environment variables
function getEmailConfig() {
  const config = {
    imapHost: process.env.EMAIL_IMAP_HOST || "imap.one.com",
    imapPort: parseInt(process.env.EMAIL_IMAP_PORT || "993"),
    smtpHost: process.env.EMAIL_SMTP_HOST || "send.one.com", 
    smtpPort: parseInt(process.env.EMAIL_SMTP_PORT || "465"),
    email: process.env.EMAIL_ADDRESS || "",
    password: process.env.EMAIL_PASSWORD || "",
    secure: process.env.EMAIL_SECURE !== "false",
  };

  return EmailConfigSchema.parse(config);
}

// Email reading tool with AI-friendly output schema
export const readEmailsTool = tool(
  async ({ limit = 10 }) => {
    try {
      const config = getEmailConfig();
      
      if (!config.email || !config.password) {
        return {
          success: false,
          error: "Email credentials not configured. Please set EMAIL_ADDRESS and EMAIL_PASSWORD environment variables.",
          emails: [],
          count: 0
        };
      }

      const client = new ImapFlow({
        host: config.imapHost,
        port: config.imapPort,
        secure: config.secure,
        auth: {
          user: config.email,
          pass: config.password,
        },
      });

      await client.connect();
      
      let lock = await client.getMailboxLock("INBOX");
      
      try {
        const list = await client.search({ all: true });
        const emailIds = list.slice(-Math.min(limit, 50)); // Cap at 50 emails
        const emails = [];
        
        for (const uid of emailIds) {
          try {
            const message = await client.fetchOne(String(uid), {
              source: true,
              envelope: true,
              bodyStructure: true,
            });
            
            const emailData = {
              id: String(uid),
              subject: message.envelope?.subject || "No Subject",
              from: message.envelope?.from?.[0]?.address || "Unknown Sender",
              fromName: message.envelope?.from?.[0]?.name || "",
              to: message.envelope?.to?.[0]?.address || "",
              date: message.envelope?.date?.toISOString() || "",
              body: await extractEmailBody(message),
              hasAttachments: hasAttachments(message),
            };
            
            emails.push(emailData);
          } catch (error) {
            console.error(`Error processing email ${uid}:`, error);
            continue;
          }
        }
        
        return {
          success: true,
          count: emails.length,
          emails: emails.reverse(), // Most recent first
          provider: `${config.imapHost}:${config.imapPort}`,
          timestamp: new Date().toISOString()
        };
        
      } finally {
        lock.release();
        await client.logout();
      }
      
    } catch (error) {
      console.error("Error reading emails:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        emails: [],
        count: 0
      };
    }
  },
  {
    name: "read_emails",
    description: `Read recent emails from the configured email provider. 
    
    AI Instructions: 
    - Always check the 'success' field first
    - Present emails in a user-friendly format with sender, subject, and date
    - If no emails found, inform the user appropriately
    - Highlight urgent or important emails based on subject/sender`,
    schema: z.object({
      limit: z.number().min(1).max(50).optional().default(10).describe("Number of recent emails to fetch (1-50, default: 10)"),
    }),
  }
);

// Email sending tool with comprehensive input validation
export const sendEmailTool = tool(
  async ({ to, subject, body, htmlBody, priority = "normal" }) => {
    try {
      const config = getEmailConfig();
      
      console.log("📧 Starting email send process...");
      console.log("📧 Recipient:", to);
      console.log("📧 Subject:", subject);
      console.log("📧 SMTP Config:", {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.secure,
        email: config.email
      });
      
      if (!config.email || !config.password) {
        return {
          success: false,
          error: "Email credentials not configured. Please set EMAIL_ADDRESS and EMAIL_PASSWORD environment variables."
        };
      }

      // Validate email address format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(to)) {
        return {
          success: false,
          error: "Invalid recipient email address format."
        };
      }

      console.log("🔧 Creating SMTP transporter...");
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.secure,
        auth: {
          user: config.email,
          pass: config.password,
        },
        connectionTimeout: 60000,
        greetingTimeout: 30000,
        socketTimeout: 60000,
        debug: true, // Enable debug logging
        logger: true, // Enable logger
      });

      // Verify SMTP connection
      try {
        console.log("🔍 Verifying SMTP connection...");
        await transporter.verify();
        console.log("✅ SMTP connection verified successfully");
      } catch (verifyError) {
        console.error("❌ SMTP verification failed:", verifyError);
        return {
          success: false,
          error: `SMTP connection failed: ${verifyError instanceof Error ? verifyError.message : "Unknown error"}`,
          troubleshooting: [
            "Check if your email provider allows SMTP access",
            "Verify SMTP server settings (host, port, secure)",
            "Ensure you're using the correct email and password",
            "Check if 2FA requires an app-specific password",
            "Verify firewall/network isn't blocking the connection"
          ]
        };
      }

      // Set priority headers
      const priorityHeaders: any = {
        'X-Mailer': 'AI-Agent-Email-Tool',
        'Date': new Date().toUTCString(),
      };
      
      if (priority === "high") {
        priorityHeaders['X-Priority'] = '1';
        priorityHeaders['X-MSMail-Priority'] = 'High';
        priorityHeaders['Importance'] = 'High';
      } else if (priority === "low") {
        priorityHeaders['X-Priority'] = '5';
        priorityHeaders['X-MSMail-Priority'] = 'Low';
        priorityHeaders['Importance'] = 'Low';
      }

      const mailOptions = {
        from: `"AI Agent" <${config.email}>`, // Better from format
        to,
        subject,
        text: body,
        ...(htmlBody && { html: htmlBody }),
        headers: priorityHeaders,
        // Add envelope to ensure proper delivery
        envelope: {
          from: config.email,
          to: [to]
        }
      };

      console.log("📧 Mail options:", JSON.stringify(mailOptions, null, 2));
      console.log("📧 Attempting to send email...");
      
      const result = await transporter.sendMail(mailOptions);
      
      console.log("✅ Email sent successfully!");
      console.log("📧 Send result:", JSON.stringify(result, null, 2));
      
      // Don't close immediately, wait a moment
      setTimeout(() => {
        transporter.close();
      }, 1000);
      
      return {
        success: true,
        messageId: result.messageId,
        response: result.response,
        accepted: result.accepted,
        rejected: result.rejected,
        pending: result.pending,
        to,
        subject,
        priority,
        provider: `${config.smtpHost}:${config.smtpPort}`,
        timestamp: new Date().toISOString(),
        deliveryInfo: {
          messageId: result.messageId,
          accepted: result.accepted || [],
          rejected: result.rejected || [],
          pending: result.pending || [],
          envelope: result.envelope
        }
      };
      
    } catch (error) {
      console.error("❌ Error sending email:", error);
      console.error("❌ Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
        
        if (errorMessage.includes("Invalid login")) {
          errorMessage = "Authentication failed. Please check your email credentials.";
        } else if (errorMessage.includes("Connection timeout")) {
          errorMessage = "Connection timeout. Please check your internet connection.";
        } else if (errorMessage.includes("ENOTFOUND")) {
          errorMessage = "DNS resolution failed. Please check the SMTP server address.";
        } else if (errorMessage.includes("ECONNREFUSED")) {
          errorMessage = "Connection refused. The SMTP server may be down or blocking connections.";
        } else if (errorMessage.includes("ETIMEDOUT")) {
          errorMessage = "Connection timed out. Check your network connection and SMTP settings.";
        }
      }
      
      return {
        success: false,
        error: errorMessage,
        originalError: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        troubleshooting: [
          "Check your email provider's SMTP settings",
          "Verify your email and password are correct",
          "Ensure SMTP access is enabled in your email account",
          "Check if 2FA requires an app-specific password",
          "Try using a different SMTP port (587 for TLS, 465 for SSL)",
          "Check firewall and network restrictions"
        ]
      };
    }
  },
  {
    name: "send_email",
    description: `Send an email through the configured email provider.
    
    AI Instructions:
    - ALWAYS ask for recipient email if not provided
    - Validate that the email address looks correct before sending
    - For business emails, suggest professional subject lines
    - Ask for confirmation before sending important emails
    - Use 'high' priority only for urgent matters
    - If HTML is needed, generate simple HTML from the text body`,
    schema: z.object({
      to: z.string().email().describe("Recipient email address (required)"),
      subject: z.string().min(1).describe("Email subject line (required)"),
      body: z.string().min(1).describe("Email body content in plain text (required)"),
      htmlBody: z.string().optional().describe("Optional HTML version of the email body"),
      priority: z.enum(["low", "normal", "high"]).optional().default("normal").describe("Email priority level"),
    }),
  }
);

// Test email connection tool
export const testEmailConnectionTool = tool(
  async ({}) => {
    try {
      const config = getEmailConfig();
      
      if (!config.email || !config.password) {
        return {
          success: false,
          error: "Email credentials not configured",
          details: {
            EMAIL_ADDRESS: config.email ? "✅ Set" : "❌ Missing",
            EMAIL_PASSWORD: config.password ? "✅ Set" : "❌ Missing",
            EMAIL_IMAP_HOST: config.imapHost,
            EMAIL_SMTP_HOST: config.smtpHost,
          }
        };
      }

      console.log("🔧 Testing email connection...");
      
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.secure,
        auth: {
          user: config.email,
          pass: config.password,
        },
        connectionTimeout: 10000,
      });

      await transporter.verify();
      transporter.close();

      return {
        success: true,
        message: "Email connection test successful",
        config: {
          imapHost: config.imapHost,
          imapPort: config.imapPort,
          smtpHost: config.smtpHost,
          smtpPort: config.smtpPort,
          email: config.email,
          secure: config.secure,
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error("❌ Connection test failed:", error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        troubleshooting: [
          "Verify your email address and password are correct",
          "Ensure you're using the full email address",
          "Check if Two-Factor Authentication requires an app password",
          "Verify SMTP/IMAP access is enabled in your email provider",
          "Check firewall/network restrictions"
        ],
        timestamp: new Date().toISOString()
      };
    }
  },
  {
    name: "test_email_connection",
    description: "Test email server connection and configuration. Use this to debug email issues.",
    schema: z.object({}),
  }
);

// Helper function to extract email body
async function extractEmailBody(message: any): Promise<string> {
  try {
    // If we have the raw source, try to extract from it
    if (message.source) {
      const source = message.source.toString();
      
      // Look for plain text content
      const textMatch = source.match(/Content-Type: text\/plain[\s\S]*?\n\n([\s\S]*?)(?=\n--|\nContent-Type|\n\.\n|$)/i);
      if (textMatch && textMatch[1]) {
        let textContent = textMatch[1].trim();
        
        // Decode quoted-printable if needed
        if (source.includes('quoted-printable')) {
          textContent = textContent
            .replace(/=\r?\n/g, '') // Remove soft line breaks
            .replace(/=([0-9A-F]{2})/g, (match: string, hex: string) => String.fromCharCode(parseInt(hex, 16))); // Decode hex
        }
        
        // Clean up and limit length
        textContent = textContent
          .replace(/\r\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
          
        return textContent.length > 1000 
          ? textContent.substring(0, 1000) + '...' 
          : textContent;
      }
      
      // Look for HTML content and strip tags
      const htmlMatch = source.match(/Content-Type: text\/html[\s\S]*?\n\n([\s\S]*?)(?=\n--|\nContent-Type|\n\.\n|$)/i);
      if (htmlMatch && htmlMatch[1]) {
        let htmlContent = htmlMatch[1].trim();
        
        // Decode quoted-printable if needed
        if (source.includes('quoted-printable')) {
          htmlContent = htmlContent
            .replace(/=\r?\n/g, '')
            .replace(/=([0-9A-F]{2})/g, (match: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
        }
        
        // Strip HTML tags and decode entities
        const textContent = htmlContent
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
          
        return textContent.length > 1000 
          ? textContent.substring(0, 1000) + '...' 
          : textContent;
      }
      
      // Fallback: extract any readable text from the source
      const lines = source.split('\n');
      let bodyStarted = false;
      let bodyLines: string[] = [];
      
      for (const line of lines) {
        if (!bodyStarted && (line.trim() === '' || line.startsWith('Content-'))) {
          if (line.trim() === '') bodyStarted = true;
          continue;
        }
        
        if (bodyStarted && !line.startsWith('--') && !line.startsWith('Content-')) {
          const cleanLine = line.replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '').trim();
          if (cleanLine.length > 0) {
            bodyLines.push(cleanLine);
          }
        }
      }
      
      const extractedText = bodyLines.join(' ').trim();
      return extractedText.length > 1000 
        ? extractedText.substring(0, 1000) + '...' 
        : extractedText || "Email body could not be extracted";
    }
    
    // Fallback for structured body
    if (message.bodyStructure) {
      if (message.bodyStructure.type === "multipart") {
        for (const part of message.bodyStructure.childNodes || []) {
          if (part.type === "text" && part.subtype === "plain") {
            return "Text email detected - body extraction requires additional processing";
          }
        }
        return "Multipart email detected - body extraction requires additional processing";
      } else if (message.bodyStructure.type === "text") {
        return "Text email detected - body extraction requires additional processing";
      }
    }
    
    return "Unable to extract email body - unsupported format";
  } catch (error) {
    console.error("Error extracting email body:", error);
    return `Error extracting email body: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// Helper function to check for attachments
function hasAttachments(message: any): boolean {
  try {
    if (message.bodyStructure?.type === "multipart") {
      return (message.bodyStructure.childNodes || []).some((part: any) => 
        part.disposition === "attachment" || 
        (part.type !== "text" && part.subtype !== "plain" && part.subtype !== "html")
      );
    }
    return false;
  } catch (error) {
    return false;
  }
} 