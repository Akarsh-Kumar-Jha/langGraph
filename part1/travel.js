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
import { ApifyClient } from "apify-client";
import fs from "fs";
import dotenv from "dotenv";
import * as z from "zod";

dotenv.config();
const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
});
const client = new ApifyClient({
  token: process.env.APIFY_TOKEN,
});

const query_validate_schema = z.object({
  related_to_travel: z.enum(["Yes", "No"]),
});

const str_query_validate_model = model.withStructuredOutput(
  query_validate_schema,
);

const travelState = Annotation.Root({
  query: Annotation(),
  query_releated_to_travel: Annotation(),
  destination: Annotation(),
  days: Annotation(),
  budget: Annotation(),
  places: Annotation(),
  hotels_info:Annotation(),
  itinerary_plan:Annotation()
});

const workflow = new StateGraph(travelState);

const query_validater = async (state) => {
  const query = state.query;

  if (!query) {
    return {
      query_releated_to_travel: "No",
    };
  }
  const model_res = await str_query_validate_model.invoke(
    `You are an User's Query Validator.Validate User's Query That The Query Is Releated To Travel Or Not.query:\n${query}`,
  );
  console.log("model_res >", model_res);
  if (model_res.related_to_travel === "No") {
    return {
      query_releated_to_travel: "No",
    };
  }

  return {
    query_releated_to_travel: "Yes",
  };
};

const enhanced_query_schema = z.object({
  destination: z.string(),
  days: z.string("Days To Stay.Return Only Number.eg 7"),
  budget: z.number("Budget According To The User's Query.Default in INR"),
});

const str_query_enhancer_model = model.withStructuredOutput(
  enhanced_query_schema,
);
const enhance_query = async (state) => {
  const query = state.query;
  const response = await str_query_enhancer_model.invoke(
    `You are a travel query analyzer.

Analyze the user's travel request and extract the required information.

User Query:
${query}

Instructions:
- Extract the destination (city, state, country, or tourist place).
- Extract the trip duration as the number of days only. Do not include words like "days". Example: "7".
- Extract the total travel budget as a numeric value only.
- If the user mentions a currency other than INR, preserve the numeric amount only. Do not convert currencies.
- If no budget is mentioned, estimate a reasonable budget based on the destination and trip duration, and return only the numeric value.
- If no duration is mentioned, assume 3 days.
- If the destination cannot be determined, return an empty string.
- Return data that strictly matches the provided schema.
- Do not include explanations or additional fields.

Output Schema:
{
  "destination": "string",
  "days": "string (number only, e.g. '7')",
  "budget": number
}`,
  );
  console.log("query fixer >", response);

  return {
    destination: response.destination,
    days: response.days,
    budget: response.budget,
  };
};

const places_tool = tool(
  async ({ area }) => {
    const input = {
      area: area,
      maxResults: 20,
    };
    const run = await client.actor("GPfQgv9KeybQWuJBY").call(input);
    console.log("Results from Places dataset");
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log('Places Items =',items.slice(0,5));
    console.log("\n\n");

    return items.slice(0,5);
  },
  {
    name: "Tourist Places Finder",
    description: "This Tool Fetches Toursist Places For a Given Place.",
    schema: z.object({
      area: z.string(),
    }),
  },
);
// const tool_res = await places_tool.invoke({area:"Darbhanga"});

const places_finder = async (state) => {
  const destination = state.destination;
  const tool_res = await places_tool.invoke({ area: destination });

  return {
    places: tool_res,
  };
};

const hotels_tool = tool(
  async ({ staring_date, ending_date, place, budget }) => {
    const input = {
      search_type: "search",
      q: `hotels in ${place}`,
      gl: "in",
      hl: "en",
      currency: "INR",
      check_in_date: staring_date,
      check_out_date: ending_date,
      adults: 1,
      children: 0,
      min_price: "0.00",
      max_price: budget,
      guest_rating: "0.0",
      vacation_rentals: false,
      max_pages: 1,
    };

    const run = await client.actor("ahpk7S3a62kOzKdE9").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log("Results from Hotels dataset");
    const { items } = await client.dataset(run.defaultDatasetId).listItems();


    console.log('Hotels Data = ',items[0].properties)

   return  (items[0].properties).slice(0, 4);
    // items.forEach((item) => {
    //   console.dir(item);
    // });
  },
  {
    name: "Hotels Finder",
    description: "This Tool Finds Hotels Information Based On Some Inputs.",
    schema: z.object({
      staring_date: z.string("Check-in Date"),
      ending_date: z.string("Check-Out Date"),
      place: z.string("Place Of Hotels"),
      budget: z.string("minimum price of hotels"),
    }),
  },
);

const hotels_finder = async (state) => {
const today = new Date();

const starting_date = today.toISOString().split("T")[0];

const endingDate = new Date(today);
endingDate.setDate(endingDate.getDate() + Number(state.days));

const ending_date = endingDate.toISOString().split("T")[0];

  console.log('Dates = ',starting_date,ending_date);

  const apfify_hotels_res = await hotels_tool.invoke({
    staring_date: starting_date,
    ending_date: ending_date,
    place: state.destination,
    budget: String(state.budget),
  });

   return {
        hotels_info:apfify_hotels_res
    }
};


const itinerary_maker = async(state) => {


//   query: Annotation(),
//   query_releated_to_travel: Annotation(),
//   destination: Annotation(),
//   days: Annotation(),
//   budget: Annotation(),
//   places: Annotation(),
//   hotels_info:Annotation()

    const itinerary_template = new PromptTemplate({
        inputVariables:["destination","days","budget","places","hotels_info"],
        template:`
        You are an expert travel planner.

Create a detailed, day-by-day travel itinerary based on the following information:

- Destination: {destination}
- Trip Duration: {days} days
- Budget: {budget}

Places to Visit:
{places}

Hotel Options:
{hotels_info}

Instructions:
- Organize the itinerary by day.
- Recommend attractions in a logical order to minimize travel time.
- Include morning, afternoon, and evening activities.
- Suggest meal breaks and local cuisine where appropriate.
- Recommend the most suitable hotel from the provided options.
- Keep all recommendations within the specified budget.
- Estimate travel time between major attractions when relevant.
- End with practical travel tips for the destination.

You are an expert travel planner.

Generate a complete HTML5 document.

Rules:
- Output ONLY valid HTML. Do not use Markdown or code fences or line gaps'.
- Use semantic HTML with inline CSS.
- Use ONLY the provided places and hotel information.
- Do NOT invent hotels, attractions, prices, ratings, opening hours, or distances.
- If information is unavailable, omit it instead of guessing.
- Ensure the total estimated trip cost stays within the specified budget.
- Create a day-wise itinerary with Morning, Afternoon, and Evening sections.
- Finish the entire document and close all HTML tags.
- Give Final HTML Ready To Compile Without Any Errors.
        `
    });

    const itinerary_chain = itinerary_template.pipe(model);
//["destination","days","budget","places","hotels_info"]
    const response = await itinerary_chain.invoke({
        destination:state.destination,
        days:state.days,
        budget:state.budget,
        places:state.places,
        hotels_info:state.hotels_info
    });

    console.log('Final Response > ',response.content);

    return {
        itinerary_plan:response.content
    }
}

workflow.addNode("validate_query", query_validater);
workflow.addNode("query_enhancer", enhance_query);
workflow.addNode("fetch_places", places_finder);
workflow.addNode("fetch_hotels", hotels_finder);
workflow.addNode("itinerary_maker",itinerary_maker);

workflow.addEdge(START, "validate_query");
workflow.addConditionalEdges(
  "validate_query",
  (state) => {
    const query_releated_to_travel = state.query_releated_to_travel;

    if (query_releated_to_travel === "No") {
      return "end";
    }
    return "query_enhancer";
  },
  {
    end: END,
    query_enhancer: "query_enhancer",
  },
);
workflow.addEdge("query_enhancer", "fetch_places");
workflow.addEdge("query_enhancer","fetch_hotels");
workflow.addEdge("fetch_places","itinerary_maker");
workflow.addEdge("fetch_hotels","itinerary_maker");

const graph = workflow.compile();

// const drawableGraph = await graph.getGraphAsync();
// const mermaid = drawableGraph.drawMermaid();

// console.log(mermaid);

// console.log(await query_validater({query:"Want A Travel Itineary For Goa 7 Days."}));

const result = await graph.invoke({
  query: "Goa Trip For 10 Days.Under 10000",
});

console.log(" \n\n\n>", result);

// const html = result.itinerary_plan
//   .replace(/^```html\s*/i, "")
//   .replace(/```$/, "");

// fs.writeFileSync("itinerary.html", html);
