import { config } from "dotenv";
import OpenAI from "openai";
import { Context, Telegraf } from "telegraf";
import { message } from "telegraf/filters";

export type ChatMessage =
  | {
      role: "user";
      content: string;
    }
  | {
      role: "assistant";
      content: string;
    };

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
  const openai = new OpenAI({
    apiKey,
  });

  let messages: ChatMessage[] = [];

  const telegram = await connectToTelegram();

  telegram.on(message("text"), async (ctx) => {
    const telegramChatId = ctx.message.chat.id;
    await ctx.telegram.sendChatAction(telegramChatId, "typing");

    const content = ctx.message.text;
    messages.push({ role: "user", content });
    messages = messages.slice(-8);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages,
    });

    const answer = response.choices[0].message.content;
    if (!answer) {
      return;
    }

    await telegram.telegram.sendMessage(Number(telegramChatId), answer);
  });
}

run();
