import { config } from "dotenv";
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import readline from "readline";

const grammarSchema = z.object({
  subject: z.string().describe("The subject of the sentence"),
  verb: z.string().describe("The verb of the sentence"),
  object: z.string().describe("The object of the sentence")
});

async function run() {
  config();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  async function readUserInput() {
    rl.question("Write a phrase: ", async (message) => {
      const { object } = await generateObject({
        model: openai("gpt-4o-mini-2024-07-18"),
        system: "You are a grammar analysis expert. Break down sentences into their grammatical components.",
        prompt: `Analyze this phrase: ${message}`,
        schema: grammarSchema
      });

      console.log(object);

      readUserInput();
    });
  }

  readUserInput();
}

run();
