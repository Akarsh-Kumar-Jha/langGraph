import {
  Annotation,
  StateGraph,
  START,
  END,
  interrupt,
  Command,
} from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import dotenv from "dotenv";

dotenv.config();

const emailState = Annotation.Root({
  user_query: Annotation(),
  draft: Annotation(),
  human_approval: Annotation(),
});
const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
});
const checkpointer = PostgresSaver.fromConnString(
  "postgresql://postgres:password@localhost:5434/langgraph",
  // optional configuration object
  {
    schema: "custom_schema", // defaults to "public"
  },
);

await checkpointer.setup();

const workflow = new StateGraph(emailState);

const llm_node = async (state) => {
  const user_query = state.user_query;
  const response = await model.invoke(
    `Write an Short Email For The User's query.\nquery:${user_query}`,
  );

  console.log("model res >", response.content);

  return {
    draft: response.content,
  };
};

const human_approval_node = async (state) => {
  const draft = state.draft;

  const decision = interrupt({
    type: "approval",
    question: "Approve This email or Not?",
    draft: draft,
  });

  return {
    human_approval: decision,
  };
};

const send_mail = async (state) => {
  const draft = state.draft;

  console.log("Mail Sent Succesfully✅", draft);
  return;
};

workflow.addNode("LLM_NODE", llm_node);
workflow.addNode("HUMAN_APPROVAL_NODE", human_approval_node);
workflow.addNode("SEND_MAIL", send_mail);

workflow.addEdge(START, "LLM_NODE");
workflow.addEdge("LLM_NODE", "HUMAN_APPROVAL_NODE");
workflow.addConditionalEdges(
  "HUMAN_APPROVAL_NODE",
  (state) => {
    const human_approval = state.human_approval;

    if (human_approval.approved) {
      return "SEND_MAIL";
    }
    if(!human_approval.approved){
        console.log('Recieved False❌',state.human_approval.approved);
        return "END";
    }
  },
  {
    SEND_MAIL: "SEND_MAIL",
    END: END,
  },
);

const graph = workflow.compile({
  checkpointer: checkpointer,
});

// const drawableGraph = await graph.getGraphAsync();
// const mermaid = drawableGraph.drawMermaid();

// console.log(mermaid);

const CONFIG = { configurable: { thread_id: "5" } };

// const result = await graph.invoke({
//     user_query:"Application For Java Internship."
// },CONFIG);

// console.log('1st run >',result);

// 2nd Run
console.log('-----2nd Run🔥----\n');


// const state = await graph.getState(CONFIG);

// console.log(state);

const result = await graph.invoke(
  new Command({
    resume: {
      approved: false,
    },
  }),
  CONFIG
);
console.log(' 2nd run >',result);
