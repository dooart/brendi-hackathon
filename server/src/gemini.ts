import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { Note } from './notes';

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
  history: { role: string; content: string }[] = [],
  context?: string
): Promise<string> {
  try {
    // Filter out system messages and ensure first message is from user
    const filteredHistory = (history || []).filter(msg => msg.role !== 'system');
    if (filteredHistory.length === 0 || filteredHistory[0].role !== 'user') {
      filteredHistory.unshift({ role: 'user', content: message });
    }

    let prompt = message;
    if (context) {
      prompt = `${context}\n\n${message}`;
    }

    const chat = geminiModel.startChat({
      history: filteredHistory
        .filter(msg => msg.content && msg.content.trim() !== '')
        .map(msg => ({
          role: msg.role === 'assistant' ? 'model' : msg.role,
          parts: [{ text: msg.content }]
        }))
    });

    const result = await chat.sendMessage(prompt);
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
): Promise<Note[]> {
  try {
    const prompt = `You are a Zettelkasten note-taking assistant. Your job is to extract the most important atomic ideas from the following assistant response and write each as a separate, permanent note.

- Create at most three notes. Prefer a single note unless there are clearly distinct, highly important ideas.
- If you create more than one note, only extract the most important atomic ideas (maximum three).
- If the message contains multiple concepts, equations, or steps, create a separate note for each one, but never more than three notes in total.
- Each note must be ONE idea only, self-contained, and as clear and useful as possible.
- Each note should be brief (2-3 sentences maximum), but you may combine closely related facts if it improves clarity.
- Do NOT include unnecessary explanation, context, or repetition—be concise, but prioritize clarity and usefulness.
- Do NOT summarize the whole topic or list steps in a single note.
- Do NOT combine unrelated ideas into a single note. If in doubt, split.
- If the message contains equations, steps, or multiple facts, create a separate note for each, but never more than three notes in total.
- Each note must stand alone and be valuable for long-term reference.
- Use Markdown for formatting (bold, italic, lists, code, quotes).
- Use LaTeX for any mathematical expressions (inline math: $...$, block math: $$...$$).

**Example:**

Message:
"The EnKF uses an ensemble of states. The forecast step propagates each state. The analysis step updates each state using observations. Perturbed observations are used to represent uncertainty."

Good (atomic, split):
{
  "notes": [
    {
      "title": "EnKF: Ensemble of States",
      "content": "The EnKF uses an ensemble of states to represent uncertainty.",
      "tags": ["EnKF", "ensemble", "uncertainty"]
    },
    {
      "title": "EnKF: Forecast Step",
      "content": "The forecast step propagates each ensemble state forward using the model.",
      "tags": ["EnKF", "forecast", "model"]
    },
    {
      "title": "EnKF: Analysis Step",
      "content": "The analysis step updates each ensemble state using observations.",
      "tags": ["EnKF", "analysis", "observations"]
    }
  ]
}

Format your response as a JSON object with a 'notes' field (an array of notes, maximum three) as above. If there are no atomic ideas, respond with "NO".

Assistant response:
${message.content}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const cleaned = response.text().replace(/```json|```/g, '').trim();
    if (!cleaned || cleaned.toLowerCase() === 'no') {
      return [];
    }
    let parsedNotes;
    try {
      const parsed = JSON.parse(cleaned);
      parsedNotes = parsed.notes;
    } catch (e) {
      throw new Error("Failed to parse notes JSON");
    }
    if (!Array.isArray(parsedNotes)) {
      parsedNotes = [parsedNotes];
    }
    const now = new Date();
    return parsedNotes.map((note: any, idx: number) => ({
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${idx}`,
      title: note.title,
      content: note.content,
      tags: note.tags,
      relatedNotes: [],
      createdAt: now,
      lastModified: now,
      source: {
        conversationId,
        messageIndex
      },
      nextReview: undefined,
      interval: undefined,
      easiness: undefined,
      repetitions: undefined,
      lastReview: undefined,
      lastPerformance: undefined
    }));
  } catch (error) {
    console.error('[Gemini] Error generating note:', error);
    throw error;
  }
}

export { geminiModel }; 