import OpenAI from 'openai';
import { NoteDatabase } from './database';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  relatedNotes: string[];
  createdAt: Date;
  lastModified: Date;
  source: {
    conversationId: string;
    messageIndex: number;
  };
  nextReview?: Date;
  interval?: number;
  easiness?: number;
  repetitions?: number;
  lastReview?: Date;
  lastPerformance?: number;
}

interface NoteDetectionCriteria {
  minMessageLength: number;
  keywords: string[];
  concepts: string[];
}

const NOTE_DETECTION_CRITERIA: NoteDetectionCriteria = {
  minMessageLength: 80,
  keywords: [
    "key concept",
    "principle",
    "theory",
    "definition",
    "explanation",
    "mechanism",
    "system"
  ],
  concepts: [
    "explanation",
    "definition",
    "principle",
    "theory",
    "mechanism",
    "system"
  ]
};

async function shouldCreateNote(
  openai: OpenAI,
  message: { role: string; content: string }
): Promise<boolean> {
  if (message.role !== 'assistant') return false;
  if (message.content.length < NOTE_DETECTION_CRITERIA.minMessageLength) return false;

  const hasKeywords = NOTE_DETECTION_CRITERIA.keywords.some(keyword =>
    message.content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasKeywords) return true;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: "You are a note detection system. Analyze if the following message contains important concepts, definitions, or explanations that would be valuable to save as a note. Respond with 'YES' or 'NO' only."
        },
        {
          role: "user",
          content: message.content
        }
      ],
      temperature: 0.3,
      max_tokens: 10
    });

    const decision = response.choices[0].message.content?.toLowerCase().trim();
    return decision === "yes";
  } catch (error) {
    console.error("Error in note detection:", error);
    return false;
  }
}

async function generateNote(
  openai: OpenAI,
  message: { role: string; content: string },
  conversationId: string,
  messageIndex: number
): Promise<Note> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `You are a Zettelkasten note-taking assistant. Create atomic, concise notes following these principles:
1. One note = One idea
2. Keep notes brief and focused (2-3 sentences maximum)
3. Use your own words, not quotes
4. Include clear connections to other concepts
5. Use precise, technical language

Format the response as JSON with this structure:
{
  "title": "Short, specific title (3-5 words)",
  "content": "One clear, atomic idea. Maximum 2-3 sentences. Focus on the core concept.",
  "tags": ["array", "of", "relevant", "tags", "for", "linking"]
}`
        },
        {
          role: "user",
          content: message.content
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
      response_format: { type: "json_object" }
    });

    const noteContent = response.choices[0].message.content;
    if (!noteContent) {
      throw new Error("Failed to generate note content");
    }

    const parsedNote = JSON.parse(noteContent);
    const now = new Date();

    return {
      id: `note_${Date.now()}`,
      title: parsedNote.title,
      content: parsedNote.content,
      tags: parsedNote.tags,
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
    };
  } catch (error) {
    console.error("Error generating note:", error);
    throw error;
  }
}

interface NoteDetectionSystem {
  process: (conversation: { role: string; content: string }[], conversationId: string) => Promise<void>;
  stop: () => void;
}

function stringSimilarity(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return 1;
  const aWords = new Set(a.split(/\W+/));
  const bWords = new Set(b.split(/\W+/));
  const intersection = new Set([...aWords].filter(x => bWords.has(x)));
  return intersection.size / Math.max(aWords.size, bWords.size);
}

function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map(s => s.toLowerCase()));
  const setB = new Set(b.map(s => s.toLowerCase()));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export function startNoteDetection(
  openai: OpenAI,
  onNoteCreated: (note: Note) => void
): NoteDetectionSystem {
  let isRunning = true;
  const noteDb = new NoteDatabase();

  const process = async (
    conversation: { role: string; content: string }[],
    conversationId: string
  ) => {
    if (!isRunning) return;

    try {
      const lastMessage = conversation[conversation.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        const shouldCreate = await shouldCreateNote(openai, lastMessage);
        if (shouldCreate) {
          const note = await generateNote(
            openai,
            lastMessage,
            conversationId,
            conversation.length - 1
          );
          // Check for similar notes before saving
          const allNotes = noteDb.getAllNotes();
          const isDuplicate = allNotes.some(existing =>
            stringSimilarity(existing.title, note.title) > 0.8 ||
            jaccardSimilarity(existing.tags, note.tags) > 0.7
          );
          if (!isDuplicate) {
            onNoteCreated(note);
          } else {
            console.log('Skipped duplicate/similar note:', note.title);
          }
        }
      }
    } catch (error) {
      console.error("Error in note detection process:", error);
    }
  };

  return {
    process,
    stop: () => {
      isRunning = false;
    }
  };
} 