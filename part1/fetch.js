import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import dotenv from "dotenv";

dotenv.config();

const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
});
const client = new MultiServerMCPClient({
  fetch: {
    transport: "stdio",
    command: "npx",
    args: ["mcp-fetch-server"],
  },
});

const tools = await client.getTools();

// console.log("Tools✅", tools);
const chatState = Annotation.Root({
  messages: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

const workflow = new StateGraph(chatState);
const model_with_tools = model.bindTools(tools);

const llm_node = async (state) => {
  const messages = state.messages;

  const response = await model_with_tools.invoke(messages);

  console.log("Model Response >", response);

  return {
    messages: [response],
  };
};

const tool_node = new ToolNode(tools);
workflow.addNode("LLM_NODE", llm_node);
workflow.addNode("TOOL_NODE", tool_node);

workflow.addEdge(START, "LLM_NODE");
workflow.addConditionalEdges("LLM_NODE", (state) => {
  const messages = state.messages;

  console.log("Tool Call Recieved✅", messages.at(-1).tool_calls);
  if (messages.at(-1).tool_calls.length) {
    return "TOOL_NODE";
  }
  return END;
});
workflow.addEdge("TOOL_NODE", "LLM_NODE");

const graph = workflow.compile();

// const drawableGraph = await graph.getGraphAsync();
// const mermaid = drawableGraph.drawMermaid();

// console.log(mermaid);

const result = await graph.invoke({
  messages: [
    new SystemMessage(
      `You are a web summarization assistant.

Use exactly one fetch tool to retrieve the webpage.

Do not fetch the same resource twice.

Do not fetch related resources such as GitHub or npm registry unless the user explicitly asks.

After the first successful fetch, produce the summary immediately.`,
    ),
    new HumanMessage(
      "I Want Summary Of https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem in txt format",
    ),
  ],
});

console.log('\n\n');

console.log(' >',result);
