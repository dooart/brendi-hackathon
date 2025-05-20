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
    "fundamental",
    "principle",
    "concept",
    "theory",
    "law",
    "method",
    "technique",
    "framework",
    "model",
    "paradigm",
    "axiom",
    "theorem",
    "formula",
    "equation",
    "definition"
  ],
  concepts: [
    "fundamental",
    "principle",
    "concept",
    "theory",
    "law",
    "method",
    "technique",
    "framework",
    "model",
    "paradigm",
    "axiom",
    "theorem",
    "formula",
    "equation",
    "definition"
  ]
};

export async function shouldCreateNote(
  geminiModel: any,
  message: { role: string; content: string }
): Promise<false | { title: string; content: string; tags: string[] }> {
  // Skip if not from assistant
  if (message.role !== 'assistant') {
    console.log('[Note Detection] Skipping - not from assistant');
    return false;
  }

  // Skip if message is too short
  if (message.content.length < 50) {
    console.log('[Note Detection] Skipping - message too short');
    return false;
  }

  // Skip if message is purely exploratory questions
  const purelyExploratoryPhrases = [
    'what would you like to explore',
    'what aspects interest you',
    'what would you like to focus on',
    'what would you like to learn more about',
    'what would you like to discuss',
    'what would you like to know',
    'what would you like to understand',
    'what would you like to investigate',
    'what would you like to examine',
    'what would you like to look into'
  ];

  const isPurelyExploratory = purelyExploratoryPhrases.some(phrase => 
    message.content.toLowerCase().includes(phrase) && 
    message.content.split('.').length <= 2
  );

  if (isPurelyExploratory) {
    console.log('[Note Detection] Skipping - purely exploratory questions');
    return false;
  }

  // Check for fundamental concept indicators
  const fundamentalIndicators = [
    'fundamental',
    'principle',
    'concept',
    'theory',
    'law',
    'method',
    'approach',
    'framework',
    'paradigm',
    'model',
    'system',
    'mechanism',
    'process',
    'strategy',
    'technique'
  ];

  const hasFundamentalContent = fundamentalIndicators.some(indicator => 
    message.content.toLowerCase().includes(indicator)
  );

  if (!hasFundamentalContent) {
    console.log('[Note Detection] Skipping - no fundamental concepts detected');
    return false;
  }

  console.log('[Note Detection] Creating note - fundamental concepts found');
  return generateNote(geminiModel, message);
}

/**
 * @deprecated This function is deprecated. Use the note generation functionality in gemini.ts instead.
 * This function will be removed in a future version.
 */
async function generateNote(
  geminiModel: any,
  message: { role: string; content: string }
): Promise<false | { title: string; content: string; tags: string[] }> {
  console.warn('[DEPRECATED] The generateNote function in notes.ts is deprecated. Use the note generation functionality in gemini.ts instead.');
  
  console.log('[Note Generation] Processing message:', {
    role: message.role,
    contentLength: message.content.length
  });

  const prompt = `You are a Zettelkasten note-taking assistant. Your job is to create notes that directly answer the user's specific question.

- Create ONE note that:
  - Directly answers the user's question
  - Includes the specific subject of the question (e.g., software name, tool, concept)
  - Explains what it is and what it's used for
  - Makes the answer complete and self-contained

- Each note must be:
  - Focused on the specific question asked
  - Clear and direct in its explanation
  - Self-contained and valuable for reference
  - Brief (2-3 sentences maximum)
  - Written in your own words
  - Specific to the subject of the question
  - Memorable and easy to understand

- Do NOT create notes for:
  - Generic concepts without the specific subject
  - Individual components or features
  - Implementation details
  - Procedural steps
  - Temporary information
  - Personal opinions
  - Questions or uncertainties
  - Related concepts that don't answer the question

- Use Markdown for formatting (bold, italic, lists, code, quotes)
- Use LaTeX for mathematical expressions (inline math: $...$, block math: $$...$$)

**Example:**

Message:
"Maintenance management software helps organizations manage their maintenance operations through three key principles: planning and scheduling, work order management, and data analysis. These help prevent equipment failures and extend machinery life."

Good (direct answer):
{
  "notes": [
    {
      "title": "Purpose of Maintenance Management Software",
      "content": "Maintenance management software is designed to prevent equipment failures and extend machinery life by coordinating maintenance operations. It achieves this through systematic planning, work order management, and data-driven analysis of maintenance activities.",
      "tags": ["maintenance", "software", "purpose", "equipment management"]
    }
  ]
}

Bad (generic concepts):
{
  "notes": [
    {
      "title": "Preventive Maintenance Principles",
      "content": "Preventive maintenance involves planning and scheduling to prevent equipment failures.",
      "tags": ["maintenance", "planning", "prevention"]
    },
    {
      "title": "Resource Management",
      "content": "Resource management optimizes the allocation of maintenance resources.",
      "tags": ["resources", "optimization", "management"]
    }
  ]
}

Format your response as a JSON object with a 'notes' field (an array of notes, maximum one) as above. If there is no clear answer or concept worth noting, respond with "NO".

Message to analyze:
${message.content}`;

  try {
    console.log('[Note Generation] Sending prompt to Gemini:', {
      promptLength: prompt.length,
      messageIncluded: prompt.includes(message.content)
    });

    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    console.log('[Note Generation] Received response:', {
      responseLength: text.length,
      isNo: text.toLowerCase() === 'no'
    });
    
    if (text.toLowerCase() === 'no') {
      return false;
    }

    const noteJson = JSON.parse(text.replace(/```json|```/g, '').trim());
    console.log('[Note Generation] Parsed note:', {
      hasNotes: !!noteJson?.notes,
      noteCount: noteJson?.notes?.length,
      firstNoteTitle: noteJson?.notes?.[0]?.title
    });

    if (noteJson && noteJson.notes && Array.isArray(noteJson.notes) && noteJson.notes.length > 0) {
      return noteJson.notes[0]; // Return the first note
    }
    return false;
  } catch (error) {
    console.error('[Note Generation] Error:', error);
    return false;
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
function isSimilarNote(note: { title: string; content: string; tags: string[] }, existingNotes: Note[]): boolean {
  // Check for exact title match
  if (existingNotes.some(existing => existing.title === note.title)) {
    return true;
  }

  // Check for similar content using a simple similarity check
  const noteWords = new Set(note.content.toLowerCase().split(/\W+/));
  return existingNotes.some(existing => {
    const existingWords = new Set(existing.content.toLowerCase().split(/\W+/));
    const intersection = new Set([...noteWords].filter(x => existingWords.has(x)));
    const similarity = intersection.size / Math.max(noteWords.size, existingWords.size);
    return similarity > 0.8; // 80% similarity threshold
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
        console.log('[Note Detection] Found assistant message, checking for note creation:', {
          messageLength: lastMessage.content.length,
          messagePreview: lastMessage.content.substring(0, 100) + '...'
        });
        const note = await shouldCreateNote(geminiModel, lastMessage);
        if (note && typeof note === 'object') {
          console.log('[Note Detection] Note created:', {
            title: note.title,
            contentLength: note.content.length,
            tags: note.tags
          });
          // Check for similar notes before saving
          const allNotes = noteDb.getAllNotes();
          if (!isSimilarNote(note, allNotes)) {
            console.log('[Note Detection] Note is unique, saving:', {
              title: note.title,
              contentLength: note.content.length
            });
            const newNote: Note = {
              ...note,
              id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              relatedNotes: [],
              createdAt: new Date(),
              lastModified: new Date(),
              source: {
                conversationId,
                messageIndex: conversation.length - 1
              },
              nextReview: undefined,
              interval: undefined,
              easiness: undefined,
              repetitions: undefined,
              lastReview: undefined,
              lastPerformance: undefined
            };
            noteDb.saveNote(newNote);
          } else {
            console.log('[Note Detection] Note is similar to existing notes, skipping');
          }
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