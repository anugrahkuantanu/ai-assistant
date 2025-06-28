import { tool } from "@langchain/core/tools";
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
import wxflows from "@wxflows/sdk/langchain";
import {
ChatPromptTemplate,
MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai"; 
import { 
  readEmailsTool, 
  sendEmailTool, 
  testEmailConnectionTool 
} from "./tools/emailTools";
import { 
  readCalendarTool, 
  createCalendarEventTool, 
  deleteCalendarEventTool,
  checkCalendarConflictsTool,
  testCalendarConnectionTool,
  forceCreateCalendarEventTool
} from "./tools/calendarTools";
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

// Connect to wxflows with error handling


// Initialize tools with robust error handling
const initializeTools = async () => {
    const tools = [];
    
    // Add email tools if configured
    if (process.env.EMAIL_ADDRESS && process.env.EMAIL_PASSWORD) {
        tools.push(readEmailsTool, sendEmailTool, testEmailConnectionTool);
        console.log("✅ Email tools loaded");
    }

    // Add calendar tools if configured
    const calendarConfigured = process.env.CALENDAR_CALDAV_URL && 
                              (process.env.CALENDAR_EMAIL || process.env.EMAIL_ADDRESS) && 
                              (process.env.CALENDAR_PASSWORD || process.env.EMAIL_PASSWORD);
    
    if (calendarConfigured) {
        tools.push(
            readCalendarTool, 
            createCalendarEventTool, 
            deleteCalendarEventTool,
            checkCalendarConflictsTool,
            testCalendarConnectionTool,
            forceCreateCalendarEventTool
        );
        console.log("✅ Calendar tools loaded (including conflict checking and deletion)");
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
            handleLLMEnd: async (output: any) => {
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
            handleLLMEnd: async (output: any) => {
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
                const promptTemplate = ChatPromptTemplate.fromMessages([
                    new SystemMessage(SYSTEM_MESSAGE),
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
        const promptTemplate = ChatPromptTemplate.fromMessages([
          new SystemMessage(SYSTEM_MESSAGE),
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
  modelConfig?: { model: string; apiKey?: string; temperature?: number; maxTokens?: number }
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
        const stream = await app.streamEvents(
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