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
    maxOutputTokens: 2048,
    temperature: 0.7,      // Increased for more creative exploration
    topP: 0.8,            // Increased for more diverse responses
    topK: 40              // Increased for more exploration
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
        })),
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
        topP: 0.8,
        topK: 40
      }
    });

    // Add system message to guide response style
    const systemMessage = `You are an exploratory study assistant. Your role is to:
1. First establish clear understanding of fundamental concepts
2. Let the explanation itself guide user interests
3. Help users clarify their questions and understanding
4. Build context through natural conversation
5. Keep responses concise but informative
6. Use markdown for formatting
7. Use LaTeX for math expressions

Example approaches:

For software/tools:
"Let me explain the core concepts behind this software. It's designed to help organizations manage their systems more effectively through three key principles:

1. **Preventive Management**: The software helps schedule regular maintenance before systems fail. This is like changing your car's oil - you do it regularly to prevent bigger problems. The challenge is finding the right balance between too frequent maintenance (wasting resources) and too infrequent (risking failures).

2. **Resource Optimization**: It helps balance tasks with available resources - people, parts, and time. This is crucial because resources are often limited, and poor allocation can lead to either wasted capacity or system overload.

3. **System Lifecycle Management**: It tracks the entire history of each system, from installation to maintenance to eventual replacement. This historical data is valuable for predicting future needs and optimizing maintenance schedules.

These principles are particularly important in [user's field] because they help prevent costly breakdowns and extend system life. The software implements these concepts through various features, but understanding these fundamentals is key to using it effectively."

For theoretical concepts:
"Let me explain the core principles of this concept. It's built around [fundamental idea], which is particularly interesting because [significance]. 

The concept works by [basic mechanism], similar to how [analogy]. This is important because [relevance to field]. What makes it fascinating is how it connects to [related concept] and influences [application].

The challenge in understanding this concept often comes from [common difficulty], but once you grasp [key principle], the rest falls into place. It's particularly relevant to [user's field] because [connection]."

For practical skills:
"Let me explain the fundamental principles behind this skill. It's based on [core concept], which is essential because [importance].

The skill works by [basic mechanism], similar to [analogy]. What makes it powerful is how it combines [principles] to achieve [outcome]. The challenge often lies in [common difficulty], but understanding [key principle] makes it much clearer.

It's particularly relevant to [user's field] because [connection]. The beauty of this skill is how it connects [concept A] with [concept B] to create [result]."

Remember:
- Start with clear, fundamental explanations
- Use analogies and examples to illustrate concepts
- Highlight interesting aspects naturally
- Let the explanation guide user interests
- Keep explanations concise but complete
- Make learning engaging and accessible
- Build on what users already know
- Encourage natural exploration through the content itself`;

    const result = await chat.sendMessage(`${systemMessage}\n\n${prompt}`);
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
    const prompt = `You are a Zettelkasten note-taking assistant. Your job is to identify the fundamental concepts that answer the user's question about the specific subject they asked about.

- Create notes that:
  - Identify fundamental concepts about the specific subject (e.g., software, tool, concept) asked about
  - Explain why each concept is key to understanding the subject
  - Show how each concept makes the subject valuable
  - Make the answer both fundamental and specific to the subject

- Each note must be:
  - Focused on ONE core concept about the specific subject
  - Clear in explaining why this concept is fundamental to the subject
  - Self-contained and valuable for reference
  - Brief (2-3 sentences maximum)
  - Written in your own words
  - Memorable and easy to understand

- Create multiple notes ONLY if:
  - There are distinct fundamental concepts that are absolutely necessary to answer the question
  - Each concept is equally important and cannot be combined
  - The concepts are truly independent of each other
  - Maximum of three notes

- Do NOT create notes for:
  - Related or supporting concepts
  - Implementation details
  - Procedural steps
  - Temporary information
  - Personal opinions
  - Questions or uncertainties
  - Features or components
  - General concepts without the specific subject

- Use Markdown for formatting (bold, italic, lists, code, quotes)
- Use LaTeX for mathematical expressions (inline math: $...$, block math: $$...$$)

**Example:**

Message:
"A tool helps organizations manage their operations through three key principles: planning, execution, and analysis. These help prevent failures and extend system life."

Good (single fundamental concept about the specific subject):
{
  "notes": [
    {
      "title": "Purpose of System Management Tool",
      "content": "The system management tool is fundamentally designed to extend system life through continuous monitoring and intervention. By providing a framework for planning, execution, and analysis, it enables organizations to prevent failures and optimize system performance.",
      "tags": ["system management", "tool", "purpose", "reliability"]
    }
  ]
}

Good (multiple fundamental concepts when absolutely necessary):
{
  "notes": [
    {
      "title": "Purpose of System Management Tool",
      "content": "The system management tool is fundamentally designed to extend system life through continuous monitoring and intervention. By providing a framework for planning, execution, and analysis, it enables organizations to prevent failures and optimize system performance.",
      "tags": ["system management", "tool", "purpose", "reliability"]
    },
    {
      "title": "Core Architecture of System Management Tool",
      "content": "The system management tool's architecture is built on a feedback loop between monitoring and intervention. This fundamental design pattern enables the tool to continuously adapt its management strategies based on system performance data.",
      "tags": ["system management", "tool", "architecture", "feedback"]
    }
  ]
}

Bad (general concept without the specific subject):
{
  "notes": [
    {
      "title": "System Lifecycle Management",
      "content": "System lifecycle management is the fundamental concept that enables organizations to prevent failures and extend system life. By viewing systems as evolving entities requiring continuous care, it provides a framework for planning, execution, and analysis.",
      "tags": ["systems thinking", "lifecycle", "reliability"]
    }
  ]
}

Bad (multiple concepts when not necessary):
{
  "notes": [
    {
      "title": "System Management Principles",
      "content": "System management combines planning, execution, and analysis to prevent failures. It also involves resource optimization and lifecycle tracking.",
      "tags": ["systems", "management", "planning", "resources"]
    },
    {
      "title": "Resource Management",
      "content": "Resource management optimizes the allocation of resources.",
      "tags": ["resources", "optimization", "management"]
    }
  ]
}

Format your response as a JSON object with a 'notes' field (an array of notes, maximum three) as above. If there is no clear fundamental concept about the specific subject that answers the question, respond with "NO".

Message to analyze:
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