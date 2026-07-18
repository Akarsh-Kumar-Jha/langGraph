import { PromptTemplate } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";
import {Annotation,StateGraph,START,END} from "@langchain/langgraph";
import dotenv from "dotenv";


dotenv.config();



const model = new ChatGroq({
    model:'llama-3.3-70b-versatile'
});

const CodeState = Annotation.Root({
    query:Annotation(),
    js_code:Annotation(),
    py_code:Annotation(),
    java_code:Annotation(),
    go_code:Annotation()
});

const workflow = new StateGraph(CodeState);

const js_code_gen = async(state) => {
    const template = new PromptTemplate({
        inputVariables:["topic"],
        template:"You Are JS Expert. Write Code In JavaScript On The Following Topic : {topic}"
    });
    const chain = template.pipe(model);

    const result = await chain.invoke({
        topic:state.query
    });

    return {
        js_code:result.content
    };
};

const py_code_gen = async(state) => {
    const template = new PromptTemplate({
        inputVariables:["topic"],
        template:"You Are Python Expert. Write Code In Python On The Following Topic : {topic}"
    });
    const chain = template.pipe(model);

    const result = await chain.invoke({
        topic:state.query
    });

    return {
        py_code:result.content
    };
};

const java_code_gen = async(state) => {
    const template = new PromptTemplate({
        inputVariables:["topic"],
        template:"You Are Java Expert. Write Code In Java On The Following Topic : {topic}"
    });
    const chain = template.pipe(model);

    const result = await chain.invoke({
        topic:state.query
    });

    return {
        java_code:result.content
    };
};

const go_code_gen = async(state) => {
    const template = new PromptTemplate({
        inputVariables:["topic"],
        template:"You Are Go Programming Language Expert. Write Code In Go On The Following Topic : {topic}"
    });
    const chain = template.pipe(model);

    const result = await chain.invoke({
        topic:state.query
    });

    return {
        go_code:result.content
    };
};


workflow.addNode("js_code_gen",js_code_gen);
workflow.addNode("py_code_gen",py_code_gen);
workflow.addNode("java_code_gen",java_code_gen);
workflow.addNode("go_code_gen",go_code_gen);



workflow.addEdge(START,"js_code_gen");
workflow.addEdge(START,"py_code_gen");
workflow.addEdge(START,"java_code_gen");
workflow.addEdge(START,"go_code_gen");

workflow.addEdge("js_code_gen",END);
workflow.addEdge("py_code_gen",END);
workflow.addEdge("java_code_gen",END);
workflow.addEdge("go_code_gen",END);


const graph = workflow.compile();

const drawableGraph = await graph.getGraphAsync();

const mermaid = drawableGraph.drawMermaid();

console.log(mermaid);

console.log('\n\n\n');

// const result = await graph.invoke({
//     query:"Web Server"
// });

// console.log(result);

