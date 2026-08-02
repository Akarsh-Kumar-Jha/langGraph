import { Annotation, StateGraph, START, END, Send } from "@langchain/langgraph";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenRouter } from "@langchain/openrouter";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate, MessagesPlaceholder, PromptTemplate } from "@langchain/core/prompts";
import * as z from "zod";
import dotenv from "dotenv";

dotenv.config();

const query_schema = z.object({
  objective: z.string().describe("The primary goal the user wants to achieve."),

  context: z
    .string()
    .describe("Relevant background or domain context for the project."),

  project_type: z.string(),

  requirements: z.object({
    functional: z.array(z.string()),
    non_functional: z.array(z.string()),
  }),

  constraints: z
    .array(z.string())
    .describe(
      "Mandatory restrictions, rules, or limitations that must be followed.",
    ),

  inputs: z
    .array(z.string())
    .describe(
      "Expected inputs, user actions, or data the software should receive.",
    ),

  outputs: z
    .array(z.string())
    .describe(
      "Expected outputs, responses, or results the software should produce.",
    ),

  user_preferences: z
    .array(z.string())
    .describe(
      "User-specified preferences such as UI style, coding style, frameworks, or implementation choices.",
    ),

  known_technologies: z
    .array(z.string())
    .describe(
      "Technologies, frameworks, libraries, or tools explicitly mentioned by the user.",
    ),

  assumptions: z
    .array(z.string())
    .describe(
      "Reasonable assumptions made while enhancing the query without changing the user's intent.",
    ),

  unknowns: z
    .array(z.string())
    .describe(
      "Missing or ambiguous information that may require clarification before implementation.",
    ),
  complexity: z.enum(["low", "medium", "high"]),

  success_criteria: z
    .array(z.string())
    .describe(
      "Measurable conditions that determine when the project is successfully completed.",
    ),
});

const plannerSchema = z.object({
  project_summary: z.string(),

  architecture: z.object({
    type: z.enum([
      "frontend_only",
      "full_stack",
      "backend_only",
      "cli",
      "desktop",
      "mobile",
      "library",
      "microservices",
      "other",
    ]),
    description: z.string(),
  }),

  agents: z.array(
    z.object({
      id: z.string(),

      type: z.enum([
        "frontend",
        "backend",
        "database",
        "ai",
        "mobile",
        "desktop",
      ]),

      description: z.string(),

      responsibilities: z.array(z.string()),

      deliverables: z.array(z.string()),

      dependencies: z.array(z.string()),

      priority: z.enum(["high", "medium", "low"]),
    }),
  ),

  milestones: z.array(z.string()),

  risks: z.array(z.string()),
});

const client = new MultiServerMCPClient({
  filesystem: {
    transport: "stdio",
    command: "cmd",
    args: [
      "/c",
      "npx",
      "-y",
      "@modelcontextprotocol/server-filesystem",
      "A:/Web Coding/test_agent",
    ],
  },

  terminal: {
    transport: "stdio",
    command: "cmd",
    args: [
      "/c",
      "npx",
      "-y",
      "@ellery/terminal-mcp",
      "--headless",
    ],
  },
});
//A:\Web Coding\test_agent

const tools = await client.getTools();

// const model = new ChatOllama({
//   model: "qwen3.5",
//   baseUrl: "https://ollama.com",
//    format: "json",
//   headers: {
//     Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
//   },
// });

const openModel = new ChatOpenRouter({
  model:"nvidia/nemotron-3-ultra-550b-a55b:free"
})

const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
});

const query_str_model = model.withStructuredOutput(query_schema);
const enhanced_query_template = new PromptTemplate({
  inputVariables: ["user_query"],
  template: `You are a software requirements analyst.

Transform the user's request into a structured representation.


user_query:{user_query}

Important rules:
- Use ONLY the fields defined in the provided output schema.
- Do NOT invent additional keys.
- Populate every field.
- If information is missing, place it in unknowns.
- If no value exists for an array field, return an empty array.
- Preserve the user's intent.
`,
});

const enhanced_query_chain = enhanced_query_template.pipe(query_str_model);

const codeState = Annotation.Root({
  user_query: Annotation(),
  enhanced_query: Annotation(),
  plan: Annotation(),
  agent_plan:Annotation(),
  worker_messages: Annotation({
    reducer: (current, updated) => [...current, ...updated],
    default: () => [],
  }),
});

const workflow = new StateGraph(codeState);

const query_enhancer = async (state) => {
  console.log("\n-------------query_enhancer node invoked------------------\n");
  const user_query = state.user_query;

  const response = await enhanced_query_chain.invoke({
    user_query: user_query,
  });

  console.log("Enhnaced User Query -> ", response);

  console.log("\n-------------query_enhancer node end------------------\n");

  return {
    enhanced_query: response,
  };
};

const planner_template = new PromptTemplate({
  inputVariables: [
    "objective",
    "context",
    "project_type",
    "requirements",
    "constraints",
    "inputs",
    "outputs",
    "user_preferences",
    "known_technologies",
    "assumptions",
    "unknowns",
    "complexity",
    "success_criteria",
  ],
  template: `You are a senior software architect and technical planner.

Your task is to analyze the enhanced project specification and create a high-level implementation plan. the user's provided specifications are below.

\nobjective:{objective}\n
context:{context}\n
project_type:{project_type}\n
requirements:{requirements}\n
constraints:{constraints}\n
inputs:{inputs}\n
outputs:{outputs}\n
user_preferences:{user_preferences}\n
known_technologies:{known_technologies}\n
assumptions:{assumptions}\n
unknowns:{unknowns}\n
complexity:{complexity}\n
success_criteria:{success_criteria}\n




Break the project into specialist implementation agents.

Rules:
- Each agent represents one major engineering domain.
- Typical agents include Frontend, Backend, Database, AI, Mobile, CLI, Desktop, or Shared.
- Create only the agents actually required by the project.
- Do NOT split an agent into smaller implementation tasks.
- Do NOT create agents for Testing, QA, Build, Deployment, Documentation, or Project Management.
- Each agent should be able to work independently in parallel.`,
});

const str_planner_model = model.withStructuredOutput(plannerSchema);
const planner_chain = planner_template.pipe(str_planner_model);

const planner_node = async (state) => {
  console.log("\n-------------planner_node node invoked------------------\n");
  const enhanced_query = state.enhanced_query;

  //     \nobjective:{objective}\n
  // context:{context}\n
  // project_type:{project_type}\n
  // requirements:{requirements}\n
  // constraints:{constraints}\n
  // inputs:{inputs}\n
  // outputs:{outputs}\n
  // user_preferences:{user_preferences}\n
  // known_technologies:{known_technologies}\n
  // assumptions:{assumptions}\n
  // unknowns:{unknowns}\n
  // complexity:{complexity}\n
  // success_criteria:{success_criteria}\n

  const response = await planner_chain.invoke({
    objective: state.enhanced_query.objective,
    context: state.enhanced_query.context,
    project_type: state.enhanced_query.project_type,
    requirements: state.enhanced_query.requirements,
    constraints: state.enhanced_query.constraints,
    inputs: state.enhanced_query.inputs,
    outputs: state.enhanced_query.outputs,
    user_preferences: state.enhanced_query.user_preferences,
    known_technologies: state.enhanced_query.known_technologies,
    assumptions: state.enhanced_query.assumptions,
    unknowns: state.enhanced_query.unknowns,
    complexity: state.enhanced_query.complexity,
    success_criteria: state.enhanced_query.success_criteria,
  });

  console.log("Planner response >", response);

  return {
    plan: response,
  };
};

// whole_project_summary:state.plan.project_summary,
//             whole_project_context:state.enhanced_query.context,
//             whole_project_type:state.enhanced_query.project_type,
//             whole_project_outputs:state.enhanced_query.outputs,
//             whole_project_requirements:state.enhanced_query.requirements,
//             whole_project_constraints:state.enhanced_query.constraints,
//             agent_id:agent.id,
//             agent_type:agent.type,
//             agent_desc:agent.description,
//             agent_responsibilities:agent.responsibilities,
//             agent_deliverables:agent.deliverables,
//             agent_dependencies:agent.dependencies,
//             agent_priority:agent.priority
const fanout = async (state) => {
  console.log("\n--------------fanout starts------------\n");
  const agents = state.plan.agents;
  return agents.map((agent) => {
    return new Send("WORKER", {
      agent_plan: agent,
      plan:state.plan,
      worker_messages:[]
    });
  });
};

const worker_template = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an expert software engineer specializing in the assigned engineering domain.

Your task is to complete ONLY the work assigned to your agent.

\nyour_task_plan:{your_plan}\n

\nwhole_project_plan:{plan}\n


You will receive:
- The complete project specification.
- The overall project architecture.
- Your assigned agent responsibilities.

Guidelines:
- Implement only your assigned responsibilities.
- Respect the whole project requirements, constraints, and user preferences etc from the whole_project.
- Do not implement features owned by other agents.
- Assume dependent agents will complete their own work.
- Produce clean, modular, production-ready code.
- Follow best practices for your assigned technology stack.
- Your task is NOT complete until every responsibility assigned to this agent has been implemented.
- Continue using tools until all deliverables have been created.
- Do not stop after creating project scaffolding.
- Only finish when every responsibility has been satisfied.
- Before finishing, verify that every deliverable exists.
- Ensure your output integrates cleanly with the overall project architecture.
- If your work depends on tools, then use the tool from the provided tools.`,
  ],
  new MessagesPlaceholder("messages")
]);

const openModelWithTools = openModel.bindTools(tools);

const chain = worker_template.pipe(openModelWithTools);
const worker = async (state) => {

//  agent_plan: agent,
//       plan:state.plan,
//       worker_messages:[]

  console.log('\n******************* Worker Started **************************\n');
  console.log('State Recieved Inside Worker ->');
  console.dir(state, { depth: null });
  const messages = state.worker_messages;

  const response = await chain.invoke({
      your_plan:state.agent_plan,
      plan:state.plan,
      messages:messages
  });

  console.log(" \n\n -------Worker Model Response >", response);

  return {
    worker_messages: [response],
  };
};

const Tool_Node = new ToolNode(tools);

workflow.addNode("QUERY_ENHANCER", query_enhancer);
workflow.addNode("PLANNER_NODE", planner_node);
workflow.addNode("WORKER", worker);
workflow.addNode("TOOL_NODE", async (state) => {
  console.log("\n---------Tool Called--------------\n");

  const result = await Tool_Node.invoke({
    messages: state.worker_messages,
  });

  console.log("----- Tool Response ->", result);

  return {
    worker_messages: result.messages,
  };
});

workflow.addEdge(START, "QUERY_ENHANCER");
workflow.addEdge("QUERY_ENHANCER", "PLANNER_NODE");
workflow.addConditionalEdges("PLANNER_NODE", fanout);
workflow.addConditionalEdges(
  "WORKER",
  async (state) => {
    console.log("\n----------Routing After Worker Node----------\n");
    const messages = state.worker_messages;
    const lastMessage = messages.at(-1);
    console.log("last Message of Worker Node >", lastMessage);
    if (lastMessage.tool_calls.length) {
      console.log("Tool Call Recieved✅ >", lastMessage.tool_calls);
      return "TOOL_NODE";
    }
    return "END";
  },
  {
    TOOL_NODE: "TOOL_NODE",
    END: END,
  },
);
workflow.addEdge("TOOL_NODE", "WORKER");

const graph = workflow.compile();

// const drawableGraph = await graph.getGraphAsync();
// const mermaid = drawableGraph.drawMermaid();

// console.log(mermaid);

const result = await graph.invoke({
  user_query:
    "Build me a todo app using React named myTodoApp.",
});

console.log("\n\nFinal State 🤖 >", result);
