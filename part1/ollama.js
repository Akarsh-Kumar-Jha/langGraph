import { ChatOllama } from "@langchain/ollama";
import dotenv from "dotenv";

dotenv.config();

const llm = new ChatOllama({
  model: "gpt-oss:120b",          // no -cloud suffix
  baseUrl: "https://ollama.com",
  headers: {
    Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
  },
});

const res = await llm.invoke("Hello");
console.log(res.content);