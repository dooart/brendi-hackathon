import OpenAI from "openai";
import { Conversation, Message } from "./types";

// Note types
export type Note = {
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
};

// Note detection criteria
type NoteDetectionCriteria = {
  minMessageLength: number;
  keywords: string[];
  concepts: string[];
};

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

// Note detection system
const shouldCreateNote = async (
  openai: OpenAI,
  message: Message
): Promise<boolean> => {
  // Basic length check
  if (message.content.length < NOTE_DETECTION_CRITERIA.minMessageLength) {
    return false;
  }

  // Check for keywords
  const hasKeywords = NOTE_DETECTION_CRITERIA.keywords.some(keyword =>
    message.content.toLowerCase().includes(keyword.toLowerCase())
  );

  if (hasKeywords) {
    return true;
  }

  // Use AI to analyze if the message contains important concepts
  try {
    const systemPrompt = [
      "You are a note detection system. Analyze if the following message contains important concepts,",
      "definitions, or explanations that would be valuable to save as a note.",
      "Consider:",
      "- Key concepts and definitions",
      "- Important examples or explanations",
      "- Core principles or theories",
      "- Valuable insights or conclusions",
      "",
      "Respond with 'YES' or 'NO' only."
    ].join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
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
};

// Note generation
const generateNote = async (
  openai: OpenAI,
  message: Message,
  conversationId: string,
  messageIndex: number
): Promise<Note> => {
  try {
    const systemPrompt = [
      "You are a note-taking assistant. Create a short, concise, well-structured note from the following message.",
      "Focus on extracting key points, main ideas, and essential information.",
      "Format the response as JSON with the following structure:",
      "{",
      '  "title": "Concise title capturing the main topic",',
      '  "content": "Well-structured content with markdown formatting. Include:',
      "    - Main points",
      "    - Key definitions",
      "    - Important examples",
      "    - Core concepts",
      '    Use bullet points and headers for better organization"',
      '  "tags": ["array", "of", "relevant", "tags"]',
      "}",
      "",
      "Guidelines:",
      "- Keep it concise but comprehensive",
      "- Use markdown for better readability",
      "- Focus on the most important information",
      "- Include only relevant tags",
      "- Structure the content with headers and bullet points",
      "- IMPORTANT: When outputting mathematical expressions, always use $...$ for inline math and $$...$$ for block math, following standard Markdown+LaTeX conventions. Do NOT use [ ... ], ( ... ), or \\( ... \\) for math. For example: Inline: $x = 2y + 1$. Block: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$. Always ensure all math is properly delimited for Markdown rendering."
    ].join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: [
            "Create a concise note from this message:",
            message.content,
            "",
            "Remember to:",
            "- Extract only the most important information",
            "- Structure it clearly with markdown",
            "- Focus on key concepts and definitions",
            "- Keep it brief but comprehensive"
          ].join("\n")
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
};

// Background note detection process
export const startNoteDetection = (
  openai: OpenAI,
  onNoteCreated: (note: Note) => void
) => {
  let isRunning = true;

  const process = async (conversation: Conversation, conversationId: string) => {
    if (!isRunning) return;

    try {
      // Process the last message in the conversation
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
}; 