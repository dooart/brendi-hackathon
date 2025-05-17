import OpenAI from 'openai';

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
}

interface NoteDetectionCriteria {
  minMessageLength: number;
  keywords: string[];
  concepts: string[];
}

const NOTE_DETECTION_CRITERIA: NoteDetectionCriteria = {
  minMessageLength: 50,
  keywords: [
    "important",
    "key concept",
    "remember",
    "note",
    "definition",
    "example",
    "principle",
    "theory",
    "formula",
    "method",
    "process",
    "technique"
  ],
  concepts: [
    "explanation",
    "definition",
    "example",
    "principle",
    "theory",
    "formula",
    "method",
    "process",
    "technique"
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
      model: "gpt-4-turbo-preview",
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
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are a note-taking assistant. Create a short, concise, well-structured note from the following message.
Format the response as JSON with the following structure:
{
  "title": "Concise title capturing the main topic",
  "content": "Well-structured content with markdown formatting. Include:
    - Main points
    - Key definitions
    - Important examples
    - Core concepts
    Use bullet points and headers for better organization",
  "tags": ["array", "of", "relevant", "tags"]
}`
        },
        {
          role: "user",
          content: message.content
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
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
      }
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

export function startNoteDetection(
  openai: OpenAI,
  onNoteCreated: (note: Note) => void
): NoteDetectionSystem {
  let isRunning = true;

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
          onNoteCreated(note);
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