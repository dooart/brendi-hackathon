import OpenAI from 'openai';
import { DocumentManager } from './documents.js';

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
    messages: conversation,
    temperature: 0.7,
  });

  return response.choices[0].message.content || '';
} 