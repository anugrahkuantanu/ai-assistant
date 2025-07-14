import { tool } from "@langchain/core/tools";
import { z } from "zod";
import {
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    trimMessages,
  } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
END,
MessagesAnnotation,
START,
StateGraph,
Annotation,
} from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
ChatPromptTemplate,
MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai"; 
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  webSearchTool,
  newsSearchTool,
  quickSearchTool,
  testSearchConnectionTool
} from "./tools/searchTools";
import { 
  checkUploadedDataTool, 
  readDataTool, 
  queryDataTool, 
  clearDataTool 
} from "./tools/dataAnalysisTools";
import { 
  analyzeDataForChartsTool, 
  createChartTool, 
  createMultiChartAnalysisTool 
} from "./tools/diagramTools";
import SYSTEM_MESSAGE from "../constants/systemMessage";

// Simplified state annotation
const CalendarStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
});

// Improved system message focusing on core behaviors


const trimmer = trimMessages({
    maxTokens: 10000,
    strategy: "last",
    tokenCounter: (msgs) => msgs.length,
    includeSystem: true,
    allowPartial: false,
    startOn: "human",
});



// MCP Client singleton
let mcpClient: Client | null = null;

// Initialize MCP client connection
const initializeMCPClient = async () => {
    if (mcpClient) {
        return mcpClient;
    }
    
    try {
        mcpClient = new Client(
            {
                name: "ai-assistant",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );
        
        const transport = new StdioClientTransport({
            command: "node",
            args: [process.cwd() + "/MCP_Server/dist/index.js"],
        });
        
        await mcpClient.connect(transport);
        console.log("✅ Connected to MCP server");
        
        return mcpClient;
    } catch (error) {
        console.error("❌ Failed to connect to MCP server:", error);
        throw error;
    }
};

// Create MCP tool wrappers
const createMCPTools = () => {
    // Email tools using MCP
    const readEmailsMCPTool = tool(async ({ limit = 10 }: { limit?: number }) => {
        const client = await initializeMCPClient();
        const result: any = await client.callTool({
            name: "read_emails",
            arguments: {
                limit,
                email: process.env.EMAIL_ADDRESS,
                password: process.env.EMAIL_PASSWORD,
                imapHost: process.env.EMAIL_IMAP_HOST || "imap.one.com",
                imapPort: parseInt(process.env.EMAIL_IMAP_PORT || "993", 10),
                secure: true
            }
        });
        return Array.isArray(result.content) ? result.content[0].text : result.content.text;
    }, {
        name: "read_emails",
        description: "Read recent emails from IMAP server",
        schema: z.object({
            limit: z.number().optional().default(10).describe("Number of emails to fetch (1-50, default: 10)")
        })
    });
    
    const sendEmailMCPTool = tool(async ({ to, subject, body, htmlBody, priority = "normal" }: { to: string; subject: string; body: string; htmlBody?: string; priority?: string }) => {
        const client = await initializeMCPClient();
        const result: any = await client.callTool({
            name: "send_email",
            arguments: {
                to,
                subject,
                body,
                htmlBody,
                priority,
                email: process.env.EMAIL_ADDRESS,
                password: process.env.EMAIL_PASSWORD,
                smtpHost: process.env.EMAIL_SMTP_HOST || "send.one.com",
                smtpPort: parseInt(process.env.EMAIL_SMTP_PORT || "465", 10),
                secure: true
            }
        });
        return Array.isArray(result.content) ? result.content[0].text : result.content.text;
    }, {
        name: "send_email",
        description: "Send email via SMTP",
        schema: z.object({
            to: z.string().describe("Recipient email address"),
            subject: z.string().describe("Email subject"),
            body: z.string().describe("Email body (plain text)"),
            htmlBody: z.string().optional().describe("HTML version of email"),
            priority: z.string().optional().default("normal").describe("Email priority: low, normal, high")
        })
    });
    
    const testEmailConnectionMCPTool = tool(async () => {
        const client = await initializeMCPClient();
        const result: any = await client.callTool({
            name: "test_email_connection",
            arguments: {
                email: process.env.EMAIL_ADDRESS,
                password: process.env.EMAIL_PASSWORD,
                smtpHost: process.env.EMAIL_SMTP_HOST || "send.one.com",
                smtpPort: parseInt(process.env.EMAIL_SMTP_PORT || "465", 10),
                secure: true
            }
        });
        return Array.isArray(result.content) ? result.content[0].text : result.content.text;
    }, {
        name: "test_email_connection",
        description: "Test email server connection",
        schema: z.object({})
    });
    
    // Calendar tools using MCP
    const readCalendarMCPTool = tool(async ({ timeRange = "today", userTimezone = "UTC" }: { timeRange?: string; userTimezone?: string }) => {
        const client = await initializeMCPClient();
        const result: any = await client.callTool({
            name: "read_calendar",
            arguments: {
                timeRange,
                userTimezone,
                caldavUrl: process.env.CALENDAR_CALDAV_URL,
                email: process.env.EMAIL_ADDRESS,
                password: process.env.EMAIL_PASSWORD,
                authMethod: "Basic"
            }
        });
        return Array.isArray(result.content) ? result.content[0].text : result.content.text;
    }, {
        name: "read_calendar",
        description: "Read calendar events for specified time range",
        schema: z.object({
            timeRange: z.string().optional().default("today").describe("Time range like 'today', 'tomorrow', 'this week', 'next 7 days'"),
            userTimezone: z.string().optional().default("UTC").describe("User's timezone (e.g., 'America/New_York')")
        })
    });
    
    const createCalendarEventMCPTool = tool(async ({ summary, startTime, endTime, description, location, userTimezone = "UTC", attendees, forceCreate }: { summary: string; startTime: string; endTime: string; description?: string; location?: string; userTimezone?: string; attendees?: string[]; forceCreate?: boolean }) => {
        const client = await initializeMCPClient();
        const result: any = await client.callTool({
            name: "create_calendar_event",
            arguments: {
                summary,
                startTime,
                endTime,
                description,
                location,
                userTimezone,
                attendees,
                forceCreate,
                caldavUrl: process.env.CALENDAR_CALDAV_URL,
                email: process.env.EMAIL_ADDRESS,
                password: process.env.EMAIL_PASSWORD,
                authMethod: "Basic"
            }
        });
        return Array.isArray(result.content) ? result.content[0].text : result.content.text;
    }, {
        name: "create_calendar_event",
        description: "Create new calendar event with conflict checking",
        schema: z.object({
            summary: z.string().describe("Event title"),
            startTime: z.string().describe("Start time (natural language or ISO format)"),
            endTime: z.string().describe("End time"),
            description: z.string().optional().describe("Event description"),
            location: z.string().optional().describe("Event location"),
            userTimezone: z.string().optional().default("UTC").describe("User's timezone"),
            attendees: z.array(z.string()).optional().describe("Array of email addresses"),
            forceCreate: z.boolean().optional().describe("Create even if conflicts exist")
        })
    });
    
    const deleteCalendarEventMCPTool = tool(async ({ eventIdentifier, userTimezone = "UTC" }: { eventIdentifier: string; userTimezone?: string }) => {
        const client = await initializeMCPClient();
        const result: any = await client.callTool({
            name: "delete_calendar_event",
            arguments: {
                eventIdentifier,
                userTimezone,
                caldavUrl: process.env.CALENDAR_CALDAV_URL,
                email: process.env.EMAIL_ADDRESS,
                password: process.env.EMAIL_PASSWORD,
                authMethod: "Basic"
            }
        });
        return Array.isArray(result.content) ? result.content[0].text : result.content.text;
    }, {
        name: "delete_calendar_event",
        description: "Delete a calendar event by UID or title",
        schema: z.object({
            eventIdentifier: z.string().describe("Event UID or unique part of event title"),
            userTimezone: z.string().optional().default("UTC").describe("User's timezone")
        })
    });
    
    const checkCalendarConflictsMCPTool = tool(async ({ startTime, endTime, userTimezone = "UTC" }: { startTime: string; endTime: string; userTimezone?: string }) => {
        const client = await initializeMCPClient();
        const result: any = await client.callTool({
            name: "check_calendar_conflicts",
            arguments: {
                startTime,
                endTime,
                userTimezone,
                caldavUrl: process.env.CALENDAR_CALDAV_URL,
                email: process.env.EMAIL_ADDRESS,
                password: process.env.EMAIL_PASSWORD,
                authMethod: "Basic"
            }
        });
        return Array.isArray(result.content) ? result.content[0].text : result.content.text;
    }, {
        name: "check_calendar_conflicts",
        description: "Check if a proposed time slot has conflicts with existing events",
        schema: z.object({
            startTime: z.string().describe("Proposed event start time"),
            endTime: z.string().describe("Proposed event end time"),
            userTimezone: z.string().optional().default("UTC").describe("User's timezone")
        })
    });
    
    const testCalendarConnectionMCPTool = tool(async () => {
        const client = await initializeMCPClient();
        const result: any = await client.callTool({
            name: "test_calendar_connection",
            arguments: {
                caldavUrl: process.env.CALENDAR_CALDAV_URL,
                email: process.env.EMAIL_ADDRESS,
                password: process.env.EMAIL_PASSWORD,
                authMethod: "Basic"
            }
        });
        return Array.isArray(result.content) ? result.content[0].text : result.content.text;
    }, {
        name: "test_calendar_connection",
        description: "Test calendar server connection",
        schema: z.object({})
    });
    
    return {
        emailTools: [readEmailsMCPTool, sendEmailMCPTool, testEmailConnectionMCPTool],
        calendarTools: [readCalendarMCPTool, createCalendarEventMCPTool, deleteCalendarEventMCPTool, checkCalendarConflictsMCPTool, testCalendarConnectionMCPTool]
    };
};

// Initialize tools with MCP integration
const initializeTools = async () => {
    const tools = [];
    
    // Add search tools (always available - no configuration required)
    tools.push(
        webSearchTool,
        newsSearchTool,
        quickSearchTool,
        testSearchConnectionTool
    );
    console.log("✅ Search tools loaded (web, news, quick search)");
    
    // Add data analysis tools (always available - no configuration required)
    tools.push(
        checkUploadedDataTool,
        readDataTool,
        queryDataTool,
        clearDataTool
    );
    console.log("✅ Data analysis tools loaded (check, read, query, clear)");
    
    // Add diagram/chart creation tools (always available - no configuration required)
    tools.push(
        analyzeDataForChartsTool,
        createChartTool,
        createMultiChartAnalysisTool
    );
    console.log("✅ Diagram tools loaded (analyze, create chart, multi-chart analysis)");
    
    // Add MCP tools if email/calendar configured
    if (process.env.EMAIL_ADDRESS && process.env.EMAIL_PASSWORD) {
        const mcpTools = createMCPTools();
        tools.push(...mcpTools.emailTools);
        console.log("✅ MCP Email tools loaded");
        
        if (process.env.CALENDAR_CALDAV_URL) {
            tools.push(...mcpTools.calendarTools);
            console.log("✅ MCP Calendar tools loaded");
        }
    }
  
    return tools;
};

// Model initialization with async tool loading
export const initialiseModel = async ({
  model = "gpt-4o",
  apiKey = process.env.OPENAI_API_KEY,
  temperature = 0.7,
  maxTokens = 4096,
}: {
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}) => {
  let modelInstance;
  
  try {
    // Initialize tools first
    const allTools = await initializeTools();
    console.log(`🛠️ Total tools loaded: ${allTools.length}`);
    
    if (model.startsWith("gpt")) {
      if (!apiKey) {
        throw new Error("OpenAI API key not provided");
      }
      
      modelInstance = new ChatOpenAI({
        model,
        openAIApiKey: apiKey,
        temperature,
        maxTokens,
        streaming: true,
        callbacks: [
          {
            handleLLMStart: async () => {
              console.log(`🚀 Starting ${model} call...`);
            },
            handleLLMEnd: async () => {
              console.log(`✅ Completed ${model} call`);
            },
            handleLLMError: async (error: Error) => {
              console.error(`❌ ${model} error:`, error);
            },
          },
        ],
      });
    } else if (model.startsWith("claude")) {
      if (!apiKey) {
        throw new Error("Anthropic API key not provided");
      }
      
      modelInstance = new ChatAnthropic({
        model,
        anthropicApiKey: apiKey,
        temperature,
        maxTokens,
        streaming: true,
        callbacks: [
          {
            handleLLMStart: async () => {
              console.log(`🚀 Starting ${model} call...`);
            },
            handleLLMEnd: async () => {
              console.log(`✅ Completed ${model} call`);
            },
            handleLLMError: async (error: Error) => {
              console.error(`❌ ${model} error:`, error);
            },
          },
        ],
      });
    } else {
      throw new Error("Unsupported model: " + model);
    }
    
    return {
      model: modelInstance.bindTools(allTools),
      toolNode: new ToolNode(allTools)
    };
  } catch (error) {
    console.error("Failed to initialize model:", error);
    throw error;
  }
};

// Simplified routing function
function shouldContinue(state: typeof CalendarStateAnnotation.State) {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the LLM makes a tool call, route to tools
  if (lastMessage.tool_calls?.length) {
    return "tools";
  }

  // If the last message is a tool result, route back to agent
  if (lastMessage.content && lastMessage._getType() === "tool") {
    return "agent";
  }

  return END;
}

// Create workflow with conflict checking
const createWorkflow = async () => {
    const { model, toolNode } = await initialiseModel({ model: "gpt-4o" });

    return new StateGraph(CalendarStateAnnotation)
        .addNode("agent", async (state) => {
            try {
                const currentSystemMessage = SYSTEM_MESSAGE.replace('{{CURRENT_TIME}}', new Date().toISOString());
                const promptTemplate = ChatPromptTemplate.fromMessages([
                    new SystemMessage(currentSystemMessage),
                    new MessagesPlaceholder("messages"),
                ]);

                const trimmedMessages = await trimmer.invoke(state.messages);
                const prompt = await promptTemplate.invoke({ messages: trimmedMessages });
                const response = await model.invoke(prompt);

                return { messages: [response] };
            } catch (error) {
                console.error("Agent node error:", error);
                return { 
                    messages: [
                        new AIMessage({
                            content: "I encountered an error processing your request. Please try again.",
                        })
                    ] 
                };
            }
        })
        .addNode("tools", toolNode)
        .addEdge(START, "agent")
        .addConditionalEdges("agent", shouldContinue, {
            "agent": "agent",
            "tools": "tools",
            [END]: END
        })
        .addEdge("tools", "agent");
};

// Create workflow with dynamic configuration
export const createWorkflowWithConfig = async ({
  model,
  apiKey,
  temperature,
  maxTokens,
}: {
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}) => {
  const { model: modelInstance, toolNode } = await initialiseModel({ model, apiKey, temperature, maxTokens });
  
  return new StateGraph(CalendarStateAnnotation)
    .addNode("agent", async (state) => {
      try {
        const currentSystemMessage = SYSTEM_MESSAGE.replace('{{CURRENT_TIME}}', new Date().toISOString());
        const promptTemplate = ChatPromptTemplate.fromMessages([
          new SystemMessage(currentSystemMessage),
          new MessagesPlaceholder("messages"),
        ]);
        
        const trimmedMessages = await trimmer.invoke(state.messages);
        const prompt = await promptTemplate.invoke({ messages: trimmedMessages });
        const response = await modelInstance.invoke(prompt);
        
        return { messages: [response] };
      } catch (error) {
        console.error("Agent node error:", error);
        return { 
          messages: [
            new AIMessage({
              content: "I encountered an error. Please try again.",
            })
          ] 
        };
      }
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
        "agent": "agent",
        "tools": "tools",
        [END]: END
    })
    .addEdge("tools", "agent");
};

// Message caching for Anthropic models
function addCachingHeaders(messages: BaseMessage[]): BaseMessage[] {
    if(!messages.length) return messages;

    const cachedMessages = [...messages];

    const addCache = (message: BaseMessage) => {
        message.content = [
            {
                type: "text",
                text: message.content as string,
                cache_control: { type: "ephemeral" },
            }
        ]
    }

    // Cache last message
    addCache(cachedMessages.at(-1)!);

    // Cache second-to-last human message
    let humanCount = 0;
    for (let i = cachedMessages.length - 1; i >= 0; i--){
        if (cachedMessages[i] instanceof HumanMessage) {
            humanCount++;
            if(humanCount === 2) {
                addCache(cachedMessages[i]);
                break;
            }
        }
    }
    
    return cachedMessages;
}

// Main entry point
export async function submitQuestion(
  messages: BaseMessage[],
  chatId: string,
  modelConfig?: { model: string; apiKey?: string; temperature?: number; maxTokens?: number },
  userId?: string
) {
    try {
        // Add caching headers for Anthropic models
        const processedMessages = modelConfig?.model.startsWith("claude") 
            ? addCachingHeaders(messages) 
            : messages;

        // Create workflow
        const workflow = modelConfig
            ? await createWorkflowWithConfig(modelConfig)
            : await createWorkflow();

        // Create checkpoint saver
        const checkpointer = new MemorySaver();
        const app = workflow.compile({ checkpointer });

        // Stream response
        const stream = app.streamEvents(
            { messages: processedMessages },
            {
                version: "v2",
                configurable: { thread_id: chatId },
                streamMode: "messages",
                runId: chatId,
            }
        );
        
        return stream;
    } catch (error) {
        console.error("Error in submitQuestion:", error);
        throw error;
    }
}