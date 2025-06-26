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
} from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import wxflows from "@wxflows/sdk/langchain";
import {
ChatPromptTemplate,
MessagesPlaceholder,
} from "@langchain/core/prompts";
import SYSTEM_MESSAGE from "@/constants/systemMessage";
import { ChatOpenAI } from "@langchain/openai"; 
import { readCalendarTool, writeCalendarTool } from "./tools/googleCalendar";

const trimmer = trimMessages({
    maxTokens: 10,
    strategy: "last",
    tokenCounter: (msgs) => msgs.length,
    includeSystem: true,
    allowPartial: false,
    startOn: "human",
})

// Connect to wxflows
const toolClient = new wxflows({
    endpoint: process.env.WXFLOWS_ENDPOINT || "",
    apikey: process.env.WXFLOWS_APIKEY,
});
  
// Initialize tools based on environment
const initializeTools = async () => {
  const wxflowsTools = await toolClient.lcTools;
  
  // Only include Google Calendar tools if the service account is configured
  const googleCalendarTools = process.env.GOOGLE_SERVICE_ACCOUNT_JSON 
    ? [readCalendarTool, writeCalendarTool]
    : [];

  return [...wxflowsTools, ...googleCalendarTools];
};

// Initialize tools
let allTools: any[] = [];
try {
  allTools = await initializeTools();
} catch (error) {
  console.error("Error initializing tools:", error);
  // Fallback to wxflows tools only
  allTools = await toolClient.lcTools;
}

const toolNode = new ToolNode(allTools);

// Accepts config for model selection
export const initialiseModel = ({
  model = "gpt-4",
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
  if (model.startsWith("gpt")) {
    modelInstance = new ChatOpenAI({
      model,
      openAIApiKey: apiKey,
      temperature,
      maxTokens,
      streaming: true,
      configuration: {},
      callbacks: [
        {
          handleLLMStart: async () => {},
          handleLLMEnd: async (output: any) => {
            console.log("🤖 End LLM call", output);
          },
        },
      ],
    });
  } else if (model.startsWith("claude")) {
    modelInstance = new ChatAnthropic({
      model,
      anthropicApiKey: apiKey,
      temperature,
      maxTokens,
      streaming: true,
      callbacks: [
        {
          handleLLMStart: async () => {},
          handleLLMEnd: async (output: any) => {
            console.log("🤖 End LLM call", output);
          },
        },
      ],
    });
  } else {
    throw new Error("Unsupported model: " + model);
  }
  return modelInstance.bindTools(allTools);
};

// Defines the funtion that determines whether to continue or not
function shouldContinue(state: typeof MessagesAnnotation.State){
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If the LLM makes a tool call, than we route to the "tools" node
    if(lastMessage.tool_calls?.length){
        return "tools";
    }

    if(lastMessage.content && lastMessage._getType() === "tool") {
        return "agent";
    }

    return END;
}

// Backward compatible createWorkflow
const createWorkflow = () => {
    const model = initialiseModel({ model: "gpt-4o" });

    console.log(model.name)

    return new StateGraph(MessagesAnnotation)
        .addNode("agent", async (state) => {
            // Create the system message content
            const systemContent = SYSTEM_MESSAGE;

            // Create the prompt template with system message and messages placeholder
            const promptTemplate = ChatPromptTemplate.fromMessages([
                new SystemMessage(systemContent, {
                    cache_control: { type: "ephemeral" },
                }),
                new MessagesPlaceholder("messages"),
            ]);

            // Trim the messages to manage conversation history
            const trimmedMessages = await trimmer.invoke(state.messages);

            // Format the prompt with the current messages
            const prompt = await promptTemplate.invoke({ messages: trimmedMessages });

            // Get response from the model
            const response = await model.invoke(prompt);

            return { messages: [response] };
        })
        .addNode("tools", toolNode)
        .addEdge(START, "agent")
        .addConditionalEdges("agent", shouldContinue)
        .addEdge("tools", "agent");
};

// New: createWorkflowWithConfig for dynamic model config
export const createWorkflowWithConfig = ({
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
  const modelInstance = initialiseModel({ model, apiKey, temperature, maxTokens });
  return new StateGraph(MessagesAnnotation)
    .addNode("agent", async (state) => {
      const systemContent = SYSTEM_MESSAGE;
      const promptTemplate = ChatPromptTemplate.fromMessages([
        new SystemMessage(systemContent, {
          cache_control: { type: "ephemeral" },
        }),
        new MessagesPlaceholder("messages"),
      ]);
      const trimmedMessages = await trimmer.invoke(state.messages);
      const prompt = await promptTemplate.invoke({ messages: trimmedMessages });
      const response = await modelInstance.invoke(prompt);
      return { messages: [response] };
    })
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");
};

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

    addCache(cachedMessages.at(-1)!);

    let humanCount = 0;
    for (let i = cachedMessages.length - 1; i>=0; i--){
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

export async function submitQuestion(
  messages: BaseMessage[],
  chatId: string,
  modelConfig?: { model: string; apiKey?: string; temperature?: number; maxTokens?: number }
) {
    // Add caching headers to messages
    const cachedMessages = addCachingHeaders(messages);


    // Create workflow with chatId and onToken callback
    const workflow = modelConfig
        ? createWorkflowWithConfig(modelConfig)
        : createWorkflow();

    // Create a checkpoint to save the state of the conversation
    const checkpointer = new MemorySaver();
    const app = workflow.compile({ checkpointer });

    const stream = await app.streamEvents(
        { messages: cachedMessages },
        {
            version: "v2",
            configurable: { thread_id: chatId },
            streamMode: "messages",
            runId: chatId,
        }
    );
    return stream;
}