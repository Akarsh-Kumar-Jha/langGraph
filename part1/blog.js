import {START,Annotation,StateGraph,END, Send} from "@langchain/langgraph";
import {PromptTemplate} from "@langchain/core/prompts";
import {ChatGroq} from "@langchain/groq";
import fs from 'node:fs';
import * as z from "zod";
import dotenv from "dotenv";



dotenv.config();


const model = new ChatGroq({
    model:"llama-3.3-70b-versatile"
});

const task_schema = z.object({
    id:z.string(),
    title:z.string(),
    brief:z.string()
});

const plan_schema = z.object({
    blog_title:z.string(),
    tasks:z.array(task_schema)
});

const section_schema = z.object({
    section_id:z.string(),
    section_title:z.string(),
    content:z.string("Detailed Content of the provided section according to the title and brief provided")
});

const blogState = Annotation.Root({
    query:Annotation(),
    plan:Annotation(),
    sections:Annotation({
        reducer:(current,update) => [...current,...update],
        default:() => []
    }),
    full_blog:Annotation()
});

const workflow = new StateGraph(blogState);

const orch_template = new PromptTemplate({
    inputVariables:["user_query"],
    template:"You are a Pro Blog Designer.Give Plan To Generate a detailed Blog in the structure provided.\n topic:{user_query}"
});

const orch_str_model = model.withStructuredOutput(plan_schema);

const orch_chain = orch_template.pipe(orch_str_model);
const orchestrator = async(state) => {``
    const user_query = state.query;
    const resp = await orch_chain.invoke({
        user_query:user_query
    });

    console.log('Orchestrator resp = ',resp);

    return {
        plan:resp
    };
    
};


const worker_template = new PromptTemplate({
    inputVariables:["blog_title","section_id","section_title","section_brief"],
    template:"You are an blog section writer.given inputs provided by the user.write blog section according to that.\nblog_title:{blog_title}\n section_id:{section_id}\n section_title:{section_title}\nsection_brief:{section_brief}"
});

const str_worker_model = model.withStructuredOutput(section_schema);

const worker_chain = worker_template.pipe(str_worker_model);

const worker = async(state) => {
    console.log('------Worker Init✅----->',state);
    const resp = await worker_chain.invoke({
        blog_title:state.blog_title,
        section_title:state.task_data.title,
        section_brief:state.task_data.brief,
        section_id:state.task_data.id
    });

    return {
        sections:[resp]
    };

};

const fanOut = async(state) => {
    const plan = state.plan;
    console.log('\nPlans =',plan);
    const tasks = plan.tasks;

    return tasks.map((task) => {
        return new Send("Worker",{blog_title:plan.blog_title,task_data:task});
    });
};

const reducer = async(state) => {
    const sections = state.sections;

    const full_section_text = sections.map((section) => {
        return `
        ${section.section_id}\n
        #${section.section_title}\n\n
        ${section.content}
        `
    }).join('\n\n');


    return {
        full_blog:full_section_text
    };
}

workflow.addNode("Orchestrator",orchestrator);
workflow.addNode("Worker",worker);
workflow.addNode("Reducer",reducer);

workflow.addEdge(START,"Orchestrator");
// workflow.addEdge("Orchestrator",END);
workflow.addConditionalEdges("Orchestrator",fanOut);
workflow.addEdge("Worker","Reducer");
workflow.addEdge("Reducer",END);


const graph = workflow.compile();


// const drawableGraph = await graph.getGraphAsync();
// const mermaid = drawableGraph.drawMermaid();


// console.log(mermaid);


const result = await graph.invoke({
    query:"Write a blog on LangChain vs LangGraph"
});

console.log(' \n>');
console.dir(result);

// const content = result.full_blog;

// fs.writeFile(`./blog.md`, content, err => {
//   if (err) {
//     console.error(err);
//   } else {
//     console.log('File Written Suceesfully✅');
//   }
// });