import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export const geminiModel = genAI.getGenerativeModel({ model: 'gemini-pro' });

export async function generateGeminiResponse(
  message: string,
  history: { role: string; content: string }[]
): Promise<string> {
  try {
    const chat = geminiModel.startChat({
      history: history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      })),
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating Gemini response:', error);
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
    const prompt = `Based on the following message, create a concise study note. 
    Extract the main concept, key points, and relevant tags.
    Format the response as JSON with the following structure:
    {
      "title": "Main concept or topic",
      "content": "Detailed explanation of the concept",
      "tags": ["tag1", "tag2", "tag3"]
    }
    
    Message: ${message.content}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      const noteData = JSON.parse(text);
      return {
        title: noteData.title,
        content: noteData.content,
        tags: noteData.tags,
      };
    } catch (parseError) {
      console.error('Error parsing Gemini response:', parseError);
      throw new Error('Failed to parse note data from Gemini response');
    }
  } catch (error) {
    console.error('Error generating note with Gemini:', error);
    throw error;
  }
} 