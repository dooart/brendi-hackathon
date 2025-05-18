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
  minMessageLength: 100,
  keywords: [
    "atomic idea",
    "core concept",
    "key principle",
    "fundamental",
    "essential",
    "critical insight",
    "central concept",
    "main argument",
    "theoretical framework",
    "methodological approach"
  ],
  concepts: [
    "atomic idea",
    "core concept",
    "key principle",
    "fundamental",
    "essential",
    "critical insight",
    "central concept",
    "main argument",
    "theoretical framework",
    "methodological approach"
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
          content: `You are a Zettelkasten note detection system. Analyze if the following message contains a single, atomic idea that would be valuable as a permanent note.

Consider these strict criteria:
1. Does it contain ONE clear, atomic idea?
2. Is it a complete thought that stands on its own?
3. Would it be valuable for future reference?
4. Is it specific enough to be linked to other notes?
5. Does it avoid being too general or obvious?

Respond with 'YES' only if ALL criteria are met, otherwise 'NO'.`
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
          content: `You are a Zettelkasten note-taking assistant. Create atomic, permanent notes following these strict principles:

1. ONE note = ONE atomic idea
2. Keep notes brief and focused (2-3 sentences maximum)
3. Use your own words, not quotes
4. Include clear connections to other concepts
5. Use precise, technical language
6. Make the note self-contained and understandable without context
7. Focus on the core concept, not examples or applications
8. Use clear, declarative statements
9. Avoid generalizations and obvious statements
10. Ensure the note can be linked to other notes

Format the response as JSON with this structure:
{
  "title": "Short, specific title (3-5 words) that captures the atomic idea",
  "content": "One clear, atomic idea. Maximum 2-3 sentences. Focus on the core concept.",
  "tags": ["array", "of", "relevant", "tags", "for", "linking", "and", "categorization"]
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

    const uniqueId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      id: uniqueId,
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