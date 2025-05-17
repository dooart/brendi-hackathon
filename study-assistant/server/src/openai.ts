import OpenAI from 'openai';
import { DocumentManager } from './documents';

export function createOpenAIClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
}

export async function getAIResponse(
  openai: OpenAI,
  conversation: { role: 'user' | 'assistant'; content: string }[],
  docManager: DocumentManager
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
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