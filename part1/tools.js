import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import {START,END,StateGraph,Annotation} from "@langchain/langgraph";
import {tool} from "@langchain/core/tools";
import {ToolNode} from "@langchain/langgraph/prebuilt";
import dotenv from "dotenv";
import * as z from "zod";


dotenv.config();


const chatState = Annotation.Root({
    messages:Annotation({
        reducer:(current,update) => [...current,...update],
        default:() => []
    })
});

const model = new ChatGroq({
    model:'openai/gpt-oss-120b'
});

const calculatorTool = tool(async ({num1,num2,operator}) => {
    if(operator === 'sum'){
        return num1 + num2;
    }else if(operator === 'sub'){
        return Math.abs(num1 - num2);
    }else if(operator = 'mul'){
        return num1*num2;
    }else{
        return "Invalid Operation";
    }
},{
    name:"Calulator",
    description:"This Function Performs Addition/Subtraction/Multiplication Between Two Given Numbers.",
    schema:z.object({
        num1:z.number(),
        num2:z.number(),
        operator:z.enum(['sum','sub','mul'])
    })
});

const workflow = new StateGraph(chatState);
const tools = [calculatorTool];
const model_with_tools = model.bindTools(tools);


const chat_llm = async(state) => {
    const messages = state.messages;

    const response = await model_with_tools.invoke(messages);

    console.log('🤖 > ',response);

    return {
        messages:[new AIMessage(response)]
    }
};

const toolNode = new ToolNode(tools);

workflow.addNode("Llm_Node",chat_llm);

workflow.addEdge(START,"Llm_Node");
workflow.addConditionalEdges("Llm_Node",(state) => {
    console.log('Tool Call Achieved✅',state.messages.at(-1).tool_calls);
    if(state.messages.at(-1).tool_calls.length){
        return "toolNode"
    };
    return END;
});
workflow.addEdge("toolNode","Llm_Node");
// workflow.addEdge("Llm_Node",END);
workflow.addNode("toolNode",toolNode);


const graph = workflow.compile();

// const drawableGraph = await graph.getGraphAsync();
// const mermaid = drawableGraph.drawMermaid();

// console.log(mermaid);


const result = await graph.invoke({messages:[new SystemMessage("You Are a Helpful Assistant.Give Response To User.If Required Make Tool Calls also."),new HumanMessage("What Is 20985 Addition by 2655")]});

console.log('>',result.messages.at(-1).content);

