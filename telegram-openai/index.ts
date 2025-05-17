import { config } from "dotenv";
import { openai } from '@ai-sdk/openai';
import { CoreMessage, generateText } from 'ai';
import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";

async function connectToTelegram() {
  const telegraf = new Telegraf<Context>(process.env.TELEGRAM_TOKEN!);
  telegraf.launch();

  const { username } = await telegraf.telegram.getMe();
  console.log(`Start chatting here: https://t.me/${username}`);

  process.once("SIGINT", () => telegraf.stop("SIGINT"));
  process.once("SIGTERM", () => telegraf.stop("SIGTERM"));

  return telegraf;
}

async function run() {
  config();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  let messages: CoreMessage[] = [];

  const telegram = await connectToTelegram();

  telegram.on(message("text"), async (ctx) => {
    const telegramChatId = ctx.message.chat.id;
    await ctx.telegram.sendChatAction(telegramChatId, "typing");

    const content = ctx.message.text;
    messages.push({ role: "user", content });
    messages = messages.slice(-8);

    const { text: answer } = await generateText({
      model: openai("gpt-4o-mini-2024-07-18"),
      messages
    });

    if (!answer) {
      return;
    }

    messages.push({ role: "assistant", content: answer });
    
    await telegram.telegram.sendMessage(Number(telegramChatId), answer);
  });
}

run();
