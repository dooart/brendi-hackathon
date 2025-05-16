import { streamText, UIMessage } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(request: Request) {
  const { messages }: { messages: UIMessage[] } = await request.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: "Messages are required" }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OpenAI API key is required" }), { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Truncate to the last 8 messages
    let truncatedMessages = messages.slice(-8);

    const result = streamText({
      model: openai('gpt-4o'),
      system: 'You are a helpful assistant.',
      messages: truncatedMessages,
      maxTokens: 500,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Failed to get response from OpenAI" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
