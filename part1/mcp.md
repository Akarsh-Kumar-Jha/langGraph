# MCP (Model Context Protocol) Workflow – Hinglish Notes

---

## 📦 Imports

```js
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import dotnev from "dotenv";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
```
- **Annotation, StateGraph, START, END** – LangGraph ka core components hain jo state‑based workflow banane ke liye use hote hain.
- **ChatGroq** – Groq ka LLM wrapper (yahan `openai/gpt-oss-120b`).
- **MultiServerMCPClient** – Model Context Protocol ka client, jo external tools ko fetch karta hai.
- **ToolNode** – Pre‑built node jo tool calls ko handle karta hai.
- **dotenv** – `.env` file se environment variables load karta hai.
- **Message classes** – LLM ke input/output messages ke liye.

---

## ⚙️ Environment Setup

```js
dotnev.config();
```
- `.env` file se sabhi variables read kar leta hai. Usually `API_KEY` ya koi bhi config yahan store hota hai.

---

## 🤖 LLM Model Initialization

```js
const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
});
```
- `ChatGroq` ka instance banaya aur `model` property me specific model ka naam diya.

---

## 🗂️ MCP Client Setup (Filesystem Transport)

```js
const client = new MultiServerMCPClient({
  filesystem: {
    transport: "stdio",
    command: "npx",
    args: ["@modelcontextprotocol/server-filesystem", "A:/Web Coding"],
  },
});
```
- Yeh client `@modelcontextprotocol/server-filesystem` ko `stdio` ke through run karta hai, aur base directory **A:/Web Coding** set karta hai.
- Isse hum local filesystem ko ek "tool" ke roop me LLM ko expose kar sakte hain.

---

## 🛠️ Tools Fetch karna

```js
const tools = await client.getTools();
```
- Client se available tools (jaise file read/write, search, etc.) ko async fetch karta hai.

---

## 🔗 Model ko Tools ke saath Bind karna

```js
const model_with_tools = model.bindTools(tools);
```
- Model ko tools ke saath bind karne se LLM apni response me `tool_calls` generate kar sakta hai.

---

## 📊 Graph State Definition

```js
const graphState = Annotation.Root({
  messages: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});
```
- `messages` ek array hai jo conversation history store karta hai.
- `reducer` har new message ko existing array ke end me push karta hai.

---

## 🏗️ Workflow (StateGraph) Create karna

```js
const workflow = new StateGraph(graphState);
```
- `StateGraph` ek directed graph banata hai jisme nodes aur edges define karte hain.

---

## 🤝 LLM Node (LLM ko call karna)

```js
const llm_node = async (state) => {
  const messages = state.messages;
  console.log("Users Query >", messages[0]);
  const response = await model_with_tools.invoke(messages);
  console.log(response);
  return { messages: [new AIMessage(response)] };
};
```
- Input: `state.messages` (user ki query + previous messages).
- Model ko invoke karta hai, response ko `AIMessage` me wrap karke state me return karta hai.

---

## 🛠️ Tool Node

```js
const tool_node = new ToolNode(tools);
```
- Ye node automatically tool calls ko execute karta hai (file read/write, search, etc.).

---

## ➕ Nodes & Edges Add karna

```js
workflow.addNode("Llm_node", llm_node);
workflow.addNode("toolNode", tool_node);
workflow.addEdge(START, "Llm_node");
```
- Start se `Llm_node` pe jaata hai.

### Conditional Edge (LLM response ke basis pe)

```js
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
```
- Agar last AI message me `tool_calls` hain → `toolNode` ko route karta hai.
- Nahi to workflow ko **END** kar deta hai.

```js
workflow.addEdge("toolNode", "Llm_node");
```
- Tool execution ke baad wapas `Llm_node` me aata hai, taaki LLM tool ka result dekh sake.

---

## 📦 Compile & Run Graph

```js
const graph = workflow.compile();
```
- Graph ko compile kar ke executable object milta hai.

```js
const result = await graph.invoke({
  messages: [
    new SystemMessage("You Are a Helpful Assistant.Give Response To User.If Required Make Tool Calls also."),
    new HumanMessage("Make A Markdown file Named mcp.md Inside langgraph/part1 folder.and write Notes in Hinglish in markdown according to the langgraph/part1/mcp.js file"),
  ],
});
```
- System aur Human messages ke saath graph invoke hota hai.
- `result` me final AI response milta hai.

---

## ✅ Summary (Hinglish)

1. **Imports** – required libraries ko load kiya.
2. **dotenv** – env vars load kiye.
3. **Model** – Groq LLM set kiya.
4. **MCP Client** – filesystem tool server ko configure kiya.
5. **Tools** – client se tools fetch kiye.
6. **Model + Tools** – bind kiya taaki LLM tool calls generate kar sake.
7. **StateGraph** – conversation state aur nodes define kiye.
8. **LLM Node** – user query ko LLM ko bhejta hai.
9. **Tool Node** – agar LLM tool call karta hai to usko execute karta hai.
10. **Conditional Edge** – tool call hone par `toolNode` pe shift hota hai, nahi to workflow end.
11. **Compile & Invoke** – graph ko run karke final response milta hai.

---

> **Note:** Ye workflow ek typical **agentic** pattern ko demonstrate karta hai – LLM decides whether to call an external tool, tool executes, phir LLM fir se respond karta hai. Isse complex tasks (file operations, search, etc.) ko LLM ke through automate kiya ja sakta hai.
