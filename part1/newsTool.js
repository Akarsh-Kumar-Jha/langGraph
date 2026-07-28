import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { START, END, StateGraph, Annotation } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { PromptTemplate } from "@langchain/core/prompts";
import dotenv from "dotenv";
import * as z from "zod";

dotenv.config();

const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
});

const query_schema = z.object({
  category: z.enum([
    "business",
    "entertainment",
    "general",
    "health",
    "science",
    "sports",
    "technology",
  ]),
});

const query_prompt_template = new PromptTemplate({
  inputVariables: ["query"],
  template:
    "You are an User's query Enhancer.Kindly Analyze User's Query and Assign a category for the query.If Not a Genuine or releated Query given by User then Simply return Not Valid Query Kindly ask Something About News.\n query:\n{query}",
});

const query_model = new ChatGroq({
  model: "llama-3.3-70b-versatile",
});

const structured_query_model = model.withStructuredOutput(query_schema);

const newsState = Annotation.Root({
  query: Annotation(),
  query_category: Annotation(),
//   overall_summary: Annotation(),
  trending_topics: Annotation(),
  atricles: Annotation(),
  one_line_summary: Annotation(),
});

const workflow = new StateGraph(newsState);

const query_enhancer = async (state) => {
  const query = state.query;

  if (query) {
    const response = await structured_query_model.invoke(query);
    // console.log("Category Response > ", response);

    return {
      query_category: response.category,
    };
  }
};

const news_tool = tool(
  async ({ category }) => {
    const news_res = await fetch(
      `https://newsapi.org/v2/top-headlines?country=us&category=${category}&pageSize=5&apiKey=f7ccd15f63084f55b9deae28a92ba91c`,
    );
    const res = await news_res.json();

    // console.log("News Response >", res);

    return res;
  },
  {
    name: "News Fetcher",
    description: "This Tool Fetches News Articles Against a Category Given.",
    schema: z.object({
      category: z.enum([
        "business",
        "entertainment",
        "general",
        "health",
        "science",
        "sports",
        "technology",
      ]),
    }),
  },
);

const news_node = async (state) => {
  const query_category = state.query_category;

  const response = await news_tool.invoke({ category: query_category });

//   console.log("News Reults >", response.articles);

  return {
    atricles: response.articles,
  };
};

const summarize_each_template = new PromptTemplate({
  inputVariables: ["articles"],
  template:
    "You are Summarization Expert.Summarize Each News Article Accurately in (50-100) Words.\n articles:\n{articles}",
});


const each_summary_schema = z.object({
    summaries:z.array(z.string())
});

const structured_each_summary_model = model.withStructuredOutput(each_summary_schema);

const summarize_each_chain = summarize_each_template.pipe(structured_each_summary_model);

const articles_summarizer = async (state) => {
  const articles = state.atricles;
  const response = await summarize_each_chain.invoke({
    articles:articles
  });

//   console.log('Articles Summary >',response.summaries);

  return {
    one_line_summary:response.summaries
  }
};

const trending_topics_template = new PromptTemplate({
    inputVariables:["articles"],
    template:"You are an Trending Topics Analyzer.Based On The Given News Aricles.Analyze Trneding Topics.\n articles:\n{articles}"
});
const trending_topics_schema = z.object({
    topics:z.array(z.string())
});
const structured_trending_topics_model = model.withStructuredOutput(trending_topics_schema);

const trending_topics_chain = trending_topics_template.pipe(structured_trending_topics_model);

const analyze_trending_topics = async(state) => {
    const articles = state.atricles;
    const response = await trending_topics_chain.invoke({
        articles:articles
    });

    // console.log('Trending Topics >',response.topics);

    return {
        trending_topics:response.topics
    }

};
// await analyze_trending_topics({articles:''})

// await articles_summarizer({articles:''})

// await news_tool.invoke({category:"sports"});

workflow.addNode("query_enhancer", query_enhancer);
workflow.addNode("news_node", news_node);
workflow.addNode("summarize_articles", articles_summarizer);
workflow.addNode("trending_topics_analyzer",analyze_trending_topics);


workflow.addEdge(START,"query_enhancer");
workflow.addEdge("query_enhancer","news_node");
workflow.addEdge("news_node","summarize_articles");
workflow.addEdge("news_node","trending_topics_analyzer");
workflow.addEdge("trending_topics_analyzer",END);
workflow.addEdge("summarize_articles",END);


const graph = workflow.compile();

// const drawableGraph = await graph.getGraphAsync();
// const mermaid = drawableGraph.drawMermaid();

// console.log(mermaid);


const result = await graph.invoke({
    query:"What Are The Movies Headlines Today?"
});

console.log('\n\n\n');

console.log(result);