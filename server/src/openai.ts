import OpenAI from 'openai';
import { DocumentManager } from './documents';

type MessageRole = 'user' | 'assistant';

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

export async function getAIResponse(
  openai: OpenAI,
  conversation: { role: MessageRole; content: string }[],
  docManager: DocumentManager
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      ...conversation,
      {
        role: 'system',
        content: 'You are a helpful study assistant. Format your responses using markdown for better readability. Use code blocks for code examples, bullet points for lists, and bold/italic text for emphasis.'
      }
    ],
    temperature: 0.7,
  });

  return response.choices[0].message.content || '';
}

export async function generateOpenAIResponse(
  message: string,
  history: { role: MessageRole; content: string }[]
): Promise<string> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });

  const conversation: { role: MessageRole; content: string }[] = [
    ...history,
    { role: 'user', content: message }
  ];

  return getAIResponse(openai, conversation, new DocumentManager());
} 