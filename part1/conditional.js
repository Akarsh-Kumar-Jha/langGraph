import { PromptTemplate } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";
import {Annotation,StateGraph,START,END} from "@langchain/langgraph";
import dotenv from "dotenv";
import * as z from "zod";


dotenv.config();

const model = new ChatGroq({
    model:"llama-3.3-70b-versatile"
});

const sentimentSchema = z.object({
    sentiment:z.enum(["positive","negative","mixed"])
});

const structuredModel = model.withStructuredOutput(sentimentSchema);


//review -> Semantic Meaning(Positive,Negative,Mixed) -> Conditional Edge(Postive,Negative,Mixed) -> Reply


const SemState = Annotation.Root({
    review:Annotation(),
    semantic_meaning:Annotation(),
    response:Annotation()
});

const workflow = new StateGraph(SemState);

const semantic_analyzer = async(state) => {
    const review = state.review;
    const template = new PromptTemplate({
        inputVariables:["review"],
        template:"You are an Review Semantic Analyzer.Analyze This Review Semantic Meaning.Give Response As (Positive,Negative,Mixed).\n review : \n{review}"
    });
    const chain = template.pipe(structuredModel);

    const result = await chain.invoke({
        review:review
    });

    console.log("Semantic -> ",result,'\n\n');

    return {
        semantic_meaning:result.sentiment
    }

};


const pos_response_gen = async(state) => {
    const review = state.review;
    const sentiment = state.semantic_meaning;

    const template = new PromptTemplate({
        inputVariables:["review"],
        template:"You Are an Company Employee.Give reply To The Customer On this Positive review Given By The Customer.\n review:{review}"
    });

    const chain = template.pipe(model);

    const result = await chain.invoke({
        review:review
    });

    return {
        response:result.content
    };
};

const mix_response_gen = async(state) => {
    const review = state.review;

    const template = new PromptTemplate({
        inputVariables:["review"],
        template:"You Are an Company Employee.Give reply To The Customer On this Mixed Semantic Meaned review Given By The Customer.\n review:{review}"
    });

    const chain = template.pipe(model);

    const result = await chain.invoke({
        review:review
    });

    return {
        response:result.content
    };
};

const neg_response_gen = async(state) => {
    const review = state.review;

    const template = new PromptTemplate({
        inputVariables:["review"],
        template:"You Are an Company Employee.Give reply To The Customer On the Negative Semantic Meaned review with the hope To be Resolved.\n review:{review}"
    });

    const chain = template.pipe(model);

    const result = await chain.invoke({
        review:review
    });

    return {
        response:result.content
    };
};

workflow.addNode("semantic_anlayzer",semantic_analyzer);
workflow.addNode("positive_response",pos_response_gen);
workflow.addNode("negative_response",neg_response_gen);
workflow.addNode("mixed_response",mix_response_gen);



workflow.addEdge(START,"semantic_anlayzer");
workflow.addConditionalEdges(
    "semantic_anlayzer",
    (state) => {
        return state.semantic_meaning;
    },
    {
        positive: "positive_response",
        negative: "negative_response",
        mixed: "mixed_response",
    }
);

workflow.addEdge("positive_response",END);
workflow.addEdge("negative_response",END);
workflow.addEdge("mixed_response",END);


const graph = workflow.compile();

const drawableGraph = await graph.getGraphAsync();

const mermaid = drawableGraph.drawMermaid();


console.log(mermaid,'\n\n\n');


const result = await graph.invoke({
    review:"The product itself is excellent and performs exactly as advertised. However, the delivery was delayed by over a week, and the packaging arrived damaged. Thankfully the product inside wasn't affected."
});


console.log(result);

