import {Annotation,StateGraph,START,END,MessagesAnnotation} from "@langchain/langgraph";
import {ChatGroq} from "@langchain/groq";
import {PostgresSaver} from "@langchain/langgraph-checkpoint-postgres";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { HumanMessage, SystemMessage,trimMessages,RemoveMessage } from "@langchain/core/messages";



dotenv.config();


const model = new ChatGroq({
    model:"openai/gpt-oss-120b"
});

const checkpointer = PostgresSaver.fromConnString(
  "postgresql://postgres:password@localhost:5434/langgraph",
  {
    schema: "custom_schema"
  }
);

const MAX_TOKENS = 40;

await checkpointer.setup();
const chatState = Annotation.Root({
    ...MessagesAnnotation.spec,
    summary:Annotation({
        reducer:(_,update) => update,
        default:() => ""
    })
});

const workflow = new StateGraph(chatState);



const chat_node = async(state) => {
    const messages = [];

    if(state.summary){
        messages.unshift(
            new SystemMessage(`
                Conversation Summary : \n ${state.summary}
                `)
        )
    };

    messages.push(...state.messages);

    console.log(' Final Mesage ✅>',messages,'\n\n');

    const response = await model.invoke(messages);

    console.log('Model response 🤖>',response.content);

    return {
        messages:[response]
    }
};


const summarize_msgs = async(state) => {

    console.log('-----------------------SUMMARIZE NODE STARTED-----------------------------\n');

    console.dir(state.messages, { depth: null });

    const context = state.messages.map((msg) => {
        return `${msg.getType()}:${msg.content}`
    }).join('\n');
    const summ_prompt = `
        you are context summarizer expert.
        summarize the provided content along with the previous summary.\n
        prev_summary:${state.summary}\n
        context:${context}

        Create a concise summary.

Keep

• user preferences

• important facts

• ongoing tasks

• decisions

Do not include greetings.
    `;


    console.log('\n\n---------Summarizer Prompt -> ',summ_prompt);

    const resp = await model.invoke(summ_prompt);

    console.log('\n\n---------Summarized Response  -> ',resp.content);

        const trimmer = trimMessages({
        maxTokens:MAX_TOKENS,
        strategy:"last",
        tokenCounter:model,
        includeSystem:true,
        startOn:"human"
    });
    console.log('****** Trimmer Called✅********\n');
    const keptMessages = await trimmer.invoke(state.messages);
    console.log('---- keptMessages ===',keptMessages,'\n');

    const keptIds = new Set(keptMessages.map(m => m.id));
    console.log('------ keptIds',keptIds,'\n');

const removals = state.messages
  .filter(m => !keptIds.has(m.id))
  .map(m => new RemoveMessage({ id: m.id }));

  console.log('----- removals =',removals);

  console.log('removals[0] instanceof RemoveMessage = ',removals[0] instanceof RemoveMessage); // should be true
console.log('removals[0]._getType?.() ?? removals[0].type == ',removals[0]._getType?.() ?? removals[0].type); // should be "remove"
  console.log('\n-----------------------SUMMARIZE NODE ENDED-----------------------------\n');
    return {
        summary:resp.content,
        messages:removals
    }

};

workflow.addNode("SUMMARIZE_MSGS",summarize_msgs);
workflow.addNode("CHAT_NODE",chat_node);

// workflow.addEdge(START,"CHAT_NODE");
workflow.addConditionalEdges(START,async(state) => {
    const text = state.messages
  .map((m) => m.content)
  .join("\n");
    console.log('Content Tokens Length == ',await model.getNumTokens(text));
    if(await model.getNumTokens(text) <= MAX_TOKENS){
        return "chat";
    }
    return "summarize";
},{
    "chat":"CHAT_NODE",
    "summarize":"SUMMARIZE_MSGS"
});
workflow.addEdge("SUMMARIZE_MSGS","CHAT_NODE");
workflow.addEdge("CHAT_NODE",END);


const graph = workflow.compile({
    checkpointer:checkpointer
});

// const drawableGraph = await graph.getGraphAsync();
// const mermaid = drawableGraph.drawMermaid();


// console.log(mermaid);


const result = await graph.invoke({
    messages:[
    // new SystemMessage({content:"You are a Helpful Assistant.Give response To the user's query",id:uuidv4() }),
    new HumanMessage({content:'i am vegitarian and i like samaosa',id:uuidv4()})
]
},{
    configurable:{
        thread_id:"1"
    }
});

console.log('\n >',result);