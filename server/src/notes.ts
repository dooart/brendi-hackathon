import { GoogleGenerativeAI } from '@google/generative-ai';
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

export async function shouldCreateNote(
  geminiModel: any,
  message: { role: string; content: string }
): Promise<false | { title: string; content: string; tags: string[] }> {
  console.log('[Note Detection] Checking if should create note for message:', {
    role: message.role,
    contentLength: message.content.length
  });

  if (message.role !== 'assistant') {
    console.log('[Note Detection] Skipping - not an assistant message');
    return false;
  }
  if (message.content.length < NOTE_DETECTION_CRITERIA.minMessageLength) {
    console.log('[Note Detection] Skipping - message too short');
    return false;
  }

  const hasKeywords = NOTE_DETECTION_CRITERIA.keywords.some(keyword =>
    message.content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasKeywords) {
    console.log('[Note Detection] Found keywords, proceeding with note creation');
    // We'll still use the LLM to generate the note content below
  }

  try {
    console.log('[Note Detection] Using AI to analyze message and possibly generate note');
    const prompt = `You are a Zettelkasten note detection and creation system.

1. Carefully read the following message.
2. If the message contains any important, non-trivial, atomic information that would be valuable as a permanent note, write a Zettelkasten-style note using the information provided. The note should be:
   - Atomic (one idea)
   - Self-contained
   - Valuable for long-term reference
   - Linkable to other notes
   - Written in your own words
   - Brief (2-3 sentences)
   - With a short, specific title and relevant tags

Format your response as valid JSON:
{
  "title": "...",
  "content": "...",
  "tags": ["...", "..."]
}

3. If there is NO such information, respond with "NO" (just the string, no explanation).

Message to analyze:
${message.content}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    console.log('[Note Detection] AI response:', text);
    if (text.toLowerCase() === 'no') {
      return false;
    }
    // Try to parse JSON
    try {
      const noteJson = JSON.parse(text.replace(/```json|```/g, '').trim());
      if (noteJson && noteJson.title && noteJson.content && Array.isArray(noteJson.tags)) {
        return noteJson;
      }
      return false;
    } catch (err) {
      console.error('[Note Detection] Could not parse note JSON:', err);
      return false;
    }
  } catch (error) {
    console.error("[Note Detection] Error in note detection:", error);
    return false;
  }
}

async function generateNote(
  geminiModel: any,
  message: { role: string; content: string },
  conversationId: string,
  messageIndex: number
): Promise<Note[]> {
  try {
    const prompt = `You are a Zettelkasten note-taking assistant. Your job is to extract the most important atomic ideas from the following message and write each as a separate, permanent note.

- If the message contains multiple concepts, equations, or steps, create a separate note for each one.
- Each note must be ONE idea only, self-contained, and as short as possible (1 sentence if possible, never more than 2).
- Do NOT summarize the whole topic or list steps in a single note.
- Each note must stand alone and be valuable for long-term reference.
- Use Markdown for formatting (bold, italic, lists, code, quotes).
- Use LaTeX for any mathematical expressions (inline math: $...$, block math: $$...$$).

**Example:**

Message:
"The Kalman Filter has a prediction step and an update step. The prediction step uses the model to estimate the next state. The update step incorporates new measurements."

Bad (not atomic):
{
  "title": "Kalman Filter Steps",
  "content": "The Kalman Filter has a prediction step and an update step. The prediction step uses the model to estimate the next state. The update step incorporates new measurements.",
  "tags": ["kalman filter", "steps"]
}

Good (atomic, split):
[
  {
    "title": "Kalman Filter: Prediction Step",
    "content": "The prediction step uses the model to estimate the next state.",
    "tags": ["kalman filter", "prediction"]
  },
  {
    "title": "Kalman Filter: Update Step",
    "content": "The update step incorporates new measurements to correct the state estimate.",
    "tags": ["kalman filter", "update"]
  }
]

Format your response as a JSON array of notes as above. If there are no atomic ideas, respond with "NO".

Message to analyze:
${message.content}`;

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const noteContent = response.text();
    if (!noteContent || noteContent.trim().toLowerCase() === 'no') {
      throw new Error("No atomic notes found");
    }
    let parsedNotes;
    try {
      parsedNotes = JSON.parse(noteContent.replace(/```json|```/g, '').trim());
    } catch (e) {
      throw new Error("Failed to parse notes JSON");
    }
    if (!Array.isArray(parsedNotes)) {
      parsedNotes = [parsedNotes];
    }
    const now = new Date();
    return parsedNotes.map((parsedNote: any, idx: number) => ({
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${idx}`,
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
    }));
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

// Utility function to normalize titles for comparison
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

// Utility function to check if a note is similar to any in a list, with logging
function isSimilarNote(newNote: Note, existingNotes: Note[]): boolean {
  const normNewTitle = normalizeTitle(newNote.title);
  return existingNotes.some(existing => {
    const normExistingTitle = normalizeTitle(existing.title);
    const titleSim = stringSimilarity(normExistingTitle, normNewTitle);
    const tagSim = jaccardSimilarity(existing.tags, newNote.tags)
    if (titleSim > 0.85 || tagSim > 0.7) {
      console.log(`[Duplicate Check] Considered duplicate (titleSim > 0.85 or tagSim > 0.7)`);
      return true;
    }
    return false;
  });
}

export { isSimilarNote };

export function startNoteDetection(
  geminiModel: any,
  onNoteCreated: (note: Note) => void
): NoteDetectionSystem {
  console.log('[Note Detection] Starting note detection system');
  let isRunning = true;
  const noteDb = new NoteDatabase();

  const process = async (
    conversation: { role: string; content: string }[],
    conversationId: string
  ) => {
    if (!isRunning) {
      console.log('[Note Detection] System stopped, skipping processing');
      return;
    }

    try {
      console.log('[Note Detection] Processing conversation:', {
        conversationId,
        messageCount: conversation.length
      });

      const lastMessage = conversation[conversation.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        console.log('[Note Detection] Found assistant message, checking for note creation');
        const shouldCreate = await shouldCreateNote(geminiModel, lastMessage);
        if (shouldCreate && typeof shouldCreate === 'object') {
          console.log('[Note Detection] Should create note, generating...');
          const notes = await generateNote(
            geminiModel,
            lastMessage,
            conversationId,
            conversation.length - 1
          );
          // Check for similar notes before saving
          const allNotes = noteDb.getAllNotes();
          notes.forEach(note => {
            if (!isSimilarNote(note, allNotes)) {
              console.log('[Note Detection] Note is unique, saving:', {
                title: note.title,
                tags: note.tags
              });
              onNoteCreated(note);
              allNotes.push(note); // Add to in-memory list to avoid near-duplicates in the same batch
            } else {
              console.log('[Note Detection] Skipped duplicate/similar note:', note.title);
            }
          });
        } else {
          console.log('[Note Detection] No note creation needed');
        }
      } else {
        console.log('[Note Detection] Last message is not from assistant, skipping');
      }
    } catch (error) {
      console.error("[Note Detection] Error in note detection process:", error);
    }
  };

  return {
    process,
    stop: () => {
      console.log('[Note Detection] Stopping note detection system');
      isRunning = false;
    }
  };
} 