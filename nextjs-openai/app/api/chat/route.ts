import { NextRequest, NextResponse } from "next/server";
import { OpenAI } from "openai";

export async function POST(request: NextRequest) {
  const { messages } = await request.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Messages are required" }, { status: 400 });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API key is required" }, { status: 500 });
    }
    const openai = new OpenAI({
      apiKey,
    });

    let truncatedMessages = messages.slice(-8);

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: truncatedMessages,
      max_tokens: 500,
    });

    const answer = response.choices[0].message.content.trim();

    return NextResponse.json({ answer });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to get response from OpenAI" }, { status: 500 });
  }
}
