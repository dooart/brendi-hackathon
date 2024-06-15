import { config } from "dotenv";
import OpenAI from "openai";
import readline from "readline";

async function run() {
  config();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }
  const openai = new OpenAI({
    apiKey,
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  async function readUserInput() {
    rl.question("Write a phrase: ", async (message) => {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `
Breakdown the following phrase into a grammatical analysis: ${message}.

Use the following format:
{
  "subject": "The subject of the sentence",
  "verb": "The verb of the sentence",
  "object": "The object of the sentence"
}
`.trim(),
          },
        ],
        max_tokens: 100,
      });

      const answer = response.choices[0].message.content?.trim();
      if (!answer) {
        console.log("No answer found");
        return;
      }

      const analysis = JSON.parse(answer);
      console.log(analysis);
      console.log();

      readUserInput();
    });
  }

  readUserInput();
}

run();
