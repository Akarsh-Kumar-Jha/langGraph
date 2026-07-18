import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import dotenv from "dotenv";
import { RunnableSequence } from "@langchain/core/runnables";

dotenv.config();

const model = new ChatGroq({
  model: "llama-3.3-70b-versatile",
});
const BlogState = Annotation.Root({
  topic: Annotation(),
  outline: Annotation(),
  blog: Annotation(),
});

const workflow = new StateGraph(BlogState);

const gen_outline = async (state) => {
  const topic = state.topic;
  const template = new PromptTemplate({
    inputVariables:["topic"],
    template:"Write An Detailed Outline Of Blog.On The Topic : {topic}"
  });
  const chain = RunnableSequence.from([template, model]);

  const result = await chain.invoke({ topic: topic });

  return {
    outline: result.content,
  };
};

const gen_blog = async (state) => {
  const topic = state.topic;
  const outline = state.outline;

  const template = new PromptTemplate({
    inputVariables:["outlne","topic"],
    template:"Write An Detailed Blog.has an Outline : \n{outlne}.and The Topic : {topic}"
  });
  const chain = RunnableSequence.from([template, model]);

  const result = await chain.invoke({
    outlne:outline,
    topic:topic
  });

  return {
    blog:result.content
  };
};

workflow.addNode("Generate_Outline", gen_outline);
workflow.addNode("Generate_Blog", gen_blog);


workflow.addEdge(START,"Generate_Outline");
workflow.addEdge("Generate_Outline","Generate_Blog");
workflow.addEdge("Generate_Blog",END);


const graph = workflow.compile();

const result = await graph.invoke({
    topic:"Mithila Independence Movement"
});


console.log(result);