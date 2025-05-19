import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

const geminiModel = genAI.getGenerativeModel({ 
  model: "models/gemini-2.0-flash",
  generationConfig: {
    maxOutputTokens: 8192,  // Increased from default
    temperature: 0.7,
    topP: 0.8,
    topK: 40
  }
});

export async function generateGeminiResponse(
  message: string,
  history: { role: string; content: string }[]
): Promise<string> {
  try {
    // Filter out system messages and ensure first message is from user
    const filteredHistory = history.filter(msg => msg.role !== 'system');
    if (filteredHistory.length === 0 || filteredHistory[0].role !== 'user') {
      filteredHistory.unshift({ role: 'user', content: message });
    }

    const chat = geminiModel.startChat({
      history: filteredHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }))
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('[Gemini] Error generating response:', error);
    throw error;
  }
}

export async function generateNoteWithGemini(
  message: { role: string; content: string },
  conversationId: string,
  messageIndex: number
): Promise<{
  title: string;
  content: string;
  tags: string[];
}> {
  try {
    const prompt = `Extract a note from the following assistant response. Respond ONLY with a valid JSON object, no explanations, no markdown, no code blocks. The JSON should have the following structure: { "title": string, "content": string, "tags": string[] }\n\nAssistant response:\n${message.content}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const cleaned = response.text().replace(/```json|```/g, '').trim();
    const noteJson = JSON.parse(cleaned);
    
    if (!noteJson) {
      throw new Error("Failed to generate note content");
    }

    return {
      title: noteJson.title,
      content: noteJson.content,
      tags: noteJson.tags
    };
  } catch (error) {
    console.error('[Gemini] Error generating note:', error);
    throw error;
  }
}

export { geminiModel }; 