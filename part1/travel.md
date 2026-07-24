# AI Travel Itinerary Planner

<img width="462" height="603" alt="image" src="https://github.com/user-attachments/assets/f78c3faf-2b76-45a8-acbb-f77ad114b809" />



An AI-powered travel planner built with **LangGraph**, **LangChain**, **Groq LLM**, and **Apify**. The application takes a user's travel query, validates it, extracts key trip details, fetches real tourist places and hotel information, and generates a complete day-wise travel itinerary as an HTML document.


## How It Works

- **Validate Query** – Checks whether the user's query is travel-related.
- **Enhance Query** – Extracts the destination, trip duration, and budget using structured output.
- **Fetch Places** – Retrieves popular tourist attractions from Apify.
- **Fetch Hotels** – Searches hotels matching the destination, travel dates, and budget.
- **Generate Itinerary** – Combines all collected information and creates a complete day-wise HTML itinerary.

## Tech Stack

- LangGraph
- LangChain
- Groq (GPT-OSS-120B)
- Apify
- Zod
- Node.js

## Features

- Travel query validation
- Structured information extraction
- Real tourist place recommendations
- Budget-based hotel search
- AI-generated day-wise itinerary
- HTML output ready to open in any browser
