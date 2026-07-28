import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import dotnev from "dotenv";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

dotnev.config();

const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
});

const client = new MultiServerMCPClient({
  filesystem: {
    transport: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", "A:/Web Coding"],
  },
});

const tools = await client.getTools();
// console.log('Tools = ',tools);

const model_with_tools = model.bindTools(tools);

const graphState = Annotation.Root({
  messages: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

const workflow = new StateGraph(graphState);

const llm_node = async (state) => {
  const messages = state.messages;
  console.log("Users Query >", messages[0]);
  const response = await model_with_tools.invoke(messages);

  console.log(response);

  return {
    messages: [new AIMessage(response)],
  };
};

const tool_node = new ToolNode(tools);

workflow.addNode("Llm_node", llm_node);
workflow.addNode("toolNode", tool_node);
workflow.addEdge(START, "Llm_node");
workflow.addConditionalEdges("Llm_node", (state) => {
  console.log(
    "Model Response In Conditional Edge >",
    state.messages.at(-1).tool_calls,
  );

  if (state.messages.at(-1).tool_calls.length) {
    return "toolNode";
  }

  return END;
});
workflow.addEdge("toolNode", "Llm_node");

const graph = workflow.compile();

// const drwableGraph = await graph.getGraphAsync();
// const mermaid = drwableGraph.drawMermaid();

// console.log(mermaid);

const result = await graph.invoke({
  messages: [
    new SystemMessage(
      "You Are a Helpful Assistant.Give Response To User.If Required Make Tool Calls also.",
    ),
    new HumanMessage(
      "Make A Express boilerplate code file Named dummy.js Inside langgraph/part1 folder.",
    ),
  ],
});

console.log(" >", result);
