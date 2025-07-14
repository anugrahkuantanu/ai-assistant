#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError, ListToolsRequestSchema, CallToolRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
// Import email functionality
import { emailTools, handleEmailTool } from "./domains/email.js";
// Import calendar functionality
import { calendarTools, handleCalendarTool } from "./domains/schedule.js";
// Create unified MCP server
const server = new Server({
    name: "unified-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Get all tools
const allTools = [
    ...emailTools,
    ...calendarTools,
];
// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: allTools,
    };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
        const { name, arguments: args } = request.params;
        // Route email tools
        const emailToolNames = ["read_emails", "send_email", "test_email_connection"];
        if (emailToolNames.includes(name)) {
            return await handleEmailTool(name, args);
        }
        // Route calendar tools
        const calendarToolNames = ["read_calendar", "check_calendar_conflicts", "create_calendar_event", "force_create_calendar_event", "delete_calendar_event", "test_calendar_connection"];
        if (calendarToolNames.includes(name)) {
            return await handleCalendarTool(name, args);
        }
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    catch (error) {
        console.error("Tool execution error:", error);
        if (error instanceof McpError) {
            throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
});
// Start the server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("🚀 Unified MCP server running on stdio");
    console.error("📧 Email tools: Available");
    console.error("📅 Calendar tools: Available");
}
// Handle graceful shutdown
process.on("SIGINT", async () => {
    console.error("🛑 Shutting down unified server...");
    process.exit(0);
});
process.on("SIGTERM", async () => {
    console.error("🛑 Shutting down unified server...");
    process.exit(0);
});
// Check if this is the main module (ES module equivalent)
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error("💥 Fatal error:", error);
        process.exit(1);
    });
}
export { server };
//# sourceMappingURL=index.js.map