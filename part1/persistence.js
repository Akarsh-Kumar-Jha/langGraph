import {
  Annotation,
  StateGraph,
  START,
  END,
  MemorySaver,
} from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import dotenv from "dotenv";
import readline from "readline";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {Pool} from "pg";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

dotenv.config({
    path:'./.env'
});


console.log('POSTGRES URL --->',process.env.POSTGRES_URL)

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

const r1 = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const chatState = Annotation.Root({
  messages: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
});

// const checkpointer = new MemorySaver();
const checkpointer = new PostgresSaver(pool);
await checkpointer.setup();

const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
});

const reponse_generator = async (state) => {
  console.log("Messages Value ===", state.messages);

  const response = await model.invoke(state.messages);
  console.log(" Model Response >", response.content);
  return {
    messages: [new AIMessage(response.content)],
  };
};

const workflow = new StateGraph(chatState);

workflow.addNode("gen_response", reponse_generator);

workflow.addEdge(START, "gen_response");
workflow.addEdge("gen_response", END);

const chatbot = workflow.compile({ checkpointer });

// const drawableGraph = await chatbot.getGraphAsync();
// const mermaid = drawableGraph.drawMermaid();

// console.log(mermaid,'\n\n\n');

const CONFIG = {
  configurable: {
    thread_id: "User-1",
  },
};

 r1.question("You > ", async (input) => {
    const query = input.trim().toLowerCase();

    if (["exit", "quit", "close"].includes(query)) {
      r1.close();
    }

    const result = await chatbot.invoke(
      {
        messages: [new HumanMessage(input)],
      },
      CONFIG,
    );

    console.log("AI >", result.messages.at(-1).content);
});