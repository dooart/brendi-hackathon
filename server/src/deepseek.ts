import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { Note } from './notes';

dotenv.config();

if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not set in environment variables');
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// deepseek chat option
// const MODEL_NAME = 'deepseek/deepseek-chat:free';
const MODEL_CODE = 'meta-llama/llama-3.3-8b-instruct:free';

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// Function to check if a note is too similar to existing notes
function isNoteDuplicate(newNote: Note, existingNotes: Note[]): boolean {
  // Enhanced text normalization
  const normalizeText = (text: string) => {
    return text
      .toLowerCase()
      // Remove LaTeX math expressions for better text comparison
      .replace(/\$[^$]*\$/g, ' ')
      .replace(/\$\$[^$]*\$\$/g, ' ')
      // Remove markdown formatting
      .replace(/[*_`]/g, '')
      // Remove extra punctuation and normalize spaces
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
  
  // Extract key concepts and phrases for semantic comparison
  const extractKeyPhrases = (text: string) => {
    const normalized = normalizeText(text);
    const phrases = [];
    
    // Extract multi-word phrases (2-4 words)
    const words = normalized.split(' ');
    for (let i = 0; i < words.length - 1; i++) {
      for (let len = 2; len <= Math.min(4, words.length - i); len++) {
        const phrase = words.slice(i, i + len).join(' ');
        if (phrase.length > 6) { // Only meaningful phrases
          phrases.push(phrase);
        }
      }
    }
    
    return phrases;
  };
  
  // Extract core concepts (important single words and compound terms)
  const extractCoreConcepts = (text: string) => {
    const normalized = normalizeText(text);
    const concepts = new Set<string>();
    
    // Split into words and find compound terms
    const words = normalized.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Add significant single words (length > 4, not common words)
      if (word.length > 4 && !['about', 'often', 'these', 'their', 'through', 'being', 'where', 'which'].includes(word)) {
        concepts.add(word);
      }
      
      // Look for compound terms (like "postmodern", "traditional notions")
      if (i < words.length - 1) {
        const compound = `${word} ${words[i + 1]}`;
        if (compound.length > 8) {
          concepts.add(compound);
        }
      }
    }
    
    return Array.from(concepts);
  };
  
  const newTitle = normalizeText(newNote.title);
  const newContent = normalizeText(newNote.content);
  const newTags = newNote.tags.map(tag => tag.toLowerCase().trim());
  const newPhrases = extractKeyPhrases(newNote.title + ' ' + newNote.content);
  const newConcepts = extractCoreConcepts(newNote.title + ' ' + newNote.content);
  
  // Check for exact duplicates first
  const exactDuplicate = existingNotes.some(note => 
    normalizeText(note.title) === newTitle || 
    normalizeText(note.content) === newContent
  );
  
  if (exactDuplicate) return true;
  
  // Enhanced similarity check with multiple factors
  const titleWeight = 0.6;
  const contentWeight = 0.4;
  // Removed tag weight from main calculation - tags should encourage connections, not prevent note creation
  const duplicateThreshold = 0.75; // Overall similarity threshold
  
  for (const note of existingNotes) {
    const existingTitle = normalizeText(note.title);
    const existingContent = normalizeText(note.content);
    const existingTags = note.tags.map(tag => tag.toLowerCase().trim());
    const existingPhrases = extractKeyPhrases(note.title + ' ' + note.content);
    const existingConcepts = extractCoreConcepts(note.title + ' ' + note.content);
    
    // Calculate individual similarity scores
    const titleSimilarity = calculateSimilarity(newTitle, existingTitle);
    const contentSimilarity = calculateSimilarity(newContent, existingContent);
    const tagSimilarity = calculateTagSimilarity(newTags, existingTags);
    
    // Calculate phrase and concept overlap
    const phraseOverlap = calculateArraySimilarity(newPhrases, existingPhrases);
    const conceptOverlap = calculateArraySimilarity(newConcepts, existingConcepts);
    
    // Calculate weighted similarity based only on title and content
    const textSimilarity = 
      (titleSimilarity * titleWeight) + 
      (contentSimilarity * contentWeight);
    
    // Additional checks for different duplicate scenarios
    const bothModeratelySimilar = titleSimilarity > 0.6 && contentSimilarity > 0.6;
    const highTextSimilarity = textSimilarity > duplicateThreshold;
    
    // Only consider tag similarity as reinforcement when text similarity is already high
    const veryHighTextWithSimilarTags = textSimilarity > 0.65 && tagSimilarity > 0.7;
    
    // New semantic similarity checks
    const highPhraseOverlap = phraseOverlap > 0.3; // Lowered from 0.4 - more sensitive
    const highConceptOverlap = conceptOverlap > 0.4; // Lowered from 0.5 - more sensitive
    const semanticallySimilar = (phraseOverlap > 0.25 && conceptOverlap > 0.3) || // Both moderate overlap
                               (phraseOverlap > 0.4) || // High phrase overlap alone
                               (conceptOverlap > 0.5) || // High concept overlap alone
                               (titleSimilarity > 0.4 && conceptOverlap > 0.35); // Similar title + concepts
    
    // Additional check for very similar core topics (same main concept, different angle)
    const sharedMainConcepts = newConcepts.filter(concept => 
      existingConcepts.some(existing => 
        existing.includes(concept) || concept.includes(existing) || 
        (concept.length > 6 && existing.length > 6 && calculateSimilarity(concept, existing) > 0.7)
      )
    ).length;
    const similarCoreTopics = sharedMainConcepts >= 2 && conceptOverlap > 0.25;
    
    // Consider it a duplicate if:
    // 1. High text similarity alone, OR
    // 2. Both title and content are moderately similar, OR  
    // 3. High text similarity combined with very similar tags (reinforcement only), OR
    // 4. Semantically similar (high phrase/concept overlap)
    if (highTextSimilarity || bothModeratelySimilar || veryHighTextWithSimilarTags || semanticallySimilar || similarCoreTopics) {
      return true;
    }
  }
  
  return false;
}

// Helper function to calculate similarity between arrays of strings
function calculateArraySimilarity(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 && arr2.length === 0) return 1;
  if (arr1.length === 0 || arr2.length === 0) return 0;
  
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const intersection = new Set([...set1].filter(item => set2.has(item)));
  const union = new Set([...set1, ...set2]);
  
  // Jaccard similarity
  return intersection.size / union.size;
}

// Helper function to calculate tag similarity
function calculateTagSimilarity(tags1: string[], tags2: string[]): number {
  if (tags1.length === 0 && tags2.length === 0) return 1;
  if (tags1.length === 0 || tags2.length === 0) return 0;
  
  const set1 = new Set(tags1);
  const set2 = new Set(tags2);
  const intersection = new Set([...set1].filter(tag => set2.has(tag)));
  const union = new Set([...set1, ...set2]);
  
  // Jaccard similarity
  return intersection.size / union.size;
}

// Simple similarity calculation using Levenshtein distance
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // If either string is empty, return 0 similarity
  if (len1 === 0 || len2 === 0) return 0;
  
  // Calculate Levenshtein distance
  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLength = Math.max(len1, len2);
  
  // Return similarity score (1 - normalized distance)
  return 1 - (distance / maxLength);
}

// Helper function to extract the first valid JSON object with 'notes' or 'note' as a key
function extractFirstValidNotesJson(text: string): string | null {
  const matches = text.match(/{[\s\S]*?}/g);
  if (!matches) return null;
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match);
      if (parsed.notes || parsed.note) {
        return match;
      }
    } catch {
      // Ignore parse errors and continue
    }
  }
  return null;
}

// Helper function to escape all backslashes for JSON parsing
function escapeBackslashesForJson(jsonString: string): string {
  // Escape all backslashes for JSON parsing
  return jsonString.replace(/\\/g, '\\\\');
}

// Helper function to clean HTML tags (especially <em>) and replace with Markdown
function cleanHtmlTags(text: string): string {
  // Replace <em>...</em> with *...* (Markdown italics)
  let cleaned = text.replace(/<em>(.*?)<\/em>/g, '*$1*');
  // Remove any stray <em> or </em>
  cleaned = cleaned.replace(/<em>|<\/em>/g, '');
  // Optionally, remove other HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  return cleaned;
}

// Helper function to wrap bare LaTeX commands in $...$ if not already in math mode
function wrapBareLatexWithMathDelimiters(text: string): string {
  // This regex matches \[a-zA-Z]+[a-zA-Z0-9]* (e.g., \scrK, \varphi) not already inside $...$
  // It avoids matching inside existing $...$ or $$...$$
  return text.replace(/\\[a-zA-Z]+[a-zA-Z0-9]*/g, (match: string, offset: number, str: string) => {
    const before = str.slice(0, offset);
    const inMath = (before.match(/\$/g) || []).length % 2 === 1;
    if (inMath) return match;
    if ((before.match(/\$\$/g) || []).length % 2 === 1) return match;
    return `$${match}$`;
  });
}

export async function generateDeepseekResponse(
  message: string,
  history: { role: string; content: string }[] = [],
  context?: string
): Promise<string> {
  console.log('[DeepSeek] Generating response...')
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

    // Add system message to guide response style
    const systemMessage = `You are an objective study assistant focused on providing clear, direct answers. Your role is to:

1. Identify and focus on the specific question or topic the user is asking about.
2. Provide a direct answer to their question first.
3. If you identify a related concept that's crucial for understanding, ask the user if they'd like to learn about it before proceeding.
4. Keep responses focused and concise.
5. Use Markdown for all formatting (italics, bold, lists, etc.) that are not math expressions.
6. Use LaTeX for all math expressions:
   - ALWAYS use $...$ for inline math (e.g., $|Ax - b|_2^2$).
   - ALWAYS use $$...$$ for block math (e.g., $$|Ax - b|_2^2$$).
   - NEVER use parentheses, brackets, or any other delimiters for math (e.g., do NOT write ( r_0 = b - Ax_0 ), always write $r_0 = b - Ax_0$).
   - NEVER use <br> or any HTML tags.
   - NEVER use Markdown code blocks (\`\`\`) for maths, use LaTeX instead always wrapping the equation in $$...$$ or $...$.
   - The result will be rendered in a Markdown renderer with KaTeX, so make sure to use the correct syntax.
7. Separate paragraphs with double newlines.

For example, always write "$r_0 = b - Ax_0$", never "( r_0 = b - Ax_0 )".`;

    // Format messages for OpenRouter API
    const messages = [
      { role: 'system', content: systemMessage },
      ...filteredHistory.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: prompt }
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3001', // Required by OpenRouter
        'X-Title': 'Study Assistant' // Optional: helps OpenRouter track usage
      },
      body: JSON.stringify({
        model: MODEL_CODE,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
        top_p: 0.8,
        top_k: 40
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json() as OpenRouterResponse;
    const content = data.choices[0].message.content;
    // Remove \boxed{...} and keep only the content inside
    const cleanedContent = cleanHtmlTags(content.replace(/\\boxed\{([^}]+)\}/g, '$1'));
    const latexProcessed = wrapBareLatexWithMathDelimiters(cleanedContent);
    return latexProcessed;
  } catch (error) {
    console.error('[DeepSeek] Error generating response:', error);
    throw error;
  }
}

export async function generateNoteWithDeepseek(
  message: { role: string; content: string },
  conversationId: string,
  messageIndex: number,
  existingNotes: Note[] = [] // Add parameter for existing notes
): Promise<Note[]> {
  try {
    console.log('[DeepSeek] Generating note...')
    const prompt = `You are a Zettelkasten note-taking assistant focused on extracting the fundamental concept that directly addresses the user's core question or issue.

Your primary goal is to identify what specific knowledge gap or misunderstanding the user has, and write a SINGLE, brief, self-contained explanation of the fundamental concept that fills that gap.

Guidelines for note creation:
1. First, identify what the user is actually asking or what concept they're missing
2. Focus on the RELATIONSHIP, RULE, or PRINCIPLE that directly answers their question
3. Write a concise explanation (2-3 sentences) of that specific concept
4. The note should prevent the user from having this same question again
5. Don't just summarize the response - capture the core insight that resolves their confusion
6. Use Markdown for formatting and LaTeX for math ($...$ for inline, $$...$$ for block)
7. Tags should reflect the specific concept, not just general topics

Examples of good vs bad notes:
BAD: "SVD has three matrices with different dimensions" 
GOOD: "SVD matrix dimensions follow the rule: for A(m×n), U is m×r, Σ is r×r, V is n×r, where r is the rank - the original matrix's row/column count directly determines each component's dimensions"

BAD: "Machine learning has different algorithms"
GOOD: "Supervised learning requires labeled training data to learn input-output mappings, while unsupervised learning finds patterns in unlabeled data without target outputs"

Create multiple notes ONLY if there are absolutely distinct fundamental concepts that cannot be combined (maximum of three notes).

IMPORTANT: You MUST respond with ONLY a valid JSON object. Do not include any other text. The JSON must follow this exact structure:
{
  "thinking": "What specific concept or knowledge gap is the user asking about? What fundamental principle would resolve their confusion?",
  "notes": [
    {
      "title": "string",
      "content": "string", 
      "tags": ["string", "string", "string"]
    }
  ]
}

If there is no clear fundamental concept that directly addresses the user's question, respond with:
{
  "thinking": "No fundamental concept identified",
  "notes": []
}

Message to analyze:
${message.content}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Study Assistant'
      },
      body: JSON.stringify({
        model: MODEL_CODE,
        messages: [
          { role: 'system', content: 'You are a Zettelkasten note-taking assistant that responds with only a JSON object and nothing else.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 0.8,
        top_k: 40,
        // response_format: {
        //   type: "json_object",
        //   json_schema: {
        //     name: "note",
        //     strict: true,
        //     schema: {
        //       type: "object",
        //       properties: {
        //         thinking: { type: "string" },
        //         notes: {
        //           type: "array",
        //           items: {
        //             type: "object",
        //             properties: {
        //               title: { type: "string" },
        //               content: { type: "string" },
        //               tags: { type: "array", items: { type: "string" } }
        //             },
        //             required: ["title", "content", "tags"]
        //           }
        //         }
        //       },
        //       required: ["thinking", "notes"]
        //     }
        //   }
        // }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json() as OpenRouterResponse;
    const content = data.choices[0].message.content;
    // Remove \boxed{...} and keep only the content inside
    const cleanedContent = cleanHtmlTags(content.replace(/\\boxed\{([^}]+)\}/g, '$1'));
    const cleaned = cleanedContent.replace(/```json|```/g, '').trim();
    
    if (!cleaned || cleaned.toLowerCase() === 'no') {
      return [];
    }

    // Wrap bare LaTeX commands in $...$
    const latexProcessed = wrapBareLatexWithMathDelimiters(cleaned);

    // Try to extract JSON if extra text is present
    let jsonString = latexProcessed;
    if (!jsonString.startsWith('{') || (!jsonString.includes('"notes"') && !jsonString.includes('"note"'))) {
      const extracted = extractFirstValidNotesJson(jsonString);
      if (!extracted) {
        console.error('[DeepSeek] Failed to extract notes JSON:', jsonString);
        throw new Error("Failed to extract notes JSON");
      }
      jsonString = extracted;
    }

    let parsedNotes;
    try {
      // Escape all backslashes for JSON parsing
      const escapedJson = escapeBackslashesForJson(jsonString);
      const parsed = JSON.parse(escapedJson);
      // Normalize top-level 'note' to 'notes'
      if (parsed.notes) {
        parsedNotes = parsed.notes;
      } else if (parsed.note) {
        parsedNotes = Array.isArray(parsed.note) ? parsed.note : [parsed.note];
        parsed.notes = parsedNotes; // Ensure downstream code always sees 'notes'
        delete parsed.note;
      } else {
        console.log('[DeepSeek] No notes or note key found in JSON:', parsed);
        return [];
      }
    } catch (e) {
      console.error('[DeepSeek] Failed to parse notes JSON:', jsonString);
      console.error('[DeepSeek] Parse error:', e);
      return [];
    }

    if (!Array.isArray(parsedNotes)) {
      parsedNotes = [parsedNotes];
    }

    // Normalize notes: accept both 'tags' and 'tag', always as array
    parsedNotes = parsedNotes.map((note: any) => {
      if (note.tag && !note.tags) {
        note.tags = Array.isArray(note.tag) ? note.tag : [note.tag];
        delete note.tag;
      }
      // If tags is not an array, convert it
      if (note.tags && !Array.isArray(note.tags)) {
        note.tags = [note.tags];
      }
      return note;
    });

    // Validate and filter out invalid notes
    const validNotes = parsedNotes.filter((note: any) => {
      if (!note || typeof note !== 'object') {
        console.log('[DeepSeek] Skipping invalid note:', note);
        return false;
      }
      if (!note.title || !note.content || !Array.isArray(note.tags)) {
        console.log('[DeepSeek] Skipping note with missing required fields:', note);
        return false;
      }
      return true;
    });

    if (validNotes.length === 0) {
      console.log('[DeepSeek] No valid notes found after validation');
      return [];
    }

    const now = new Date();
    const newNotes = validNotes.map((note: any, idx: number) => ({
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

    // Filter out duplicate notes
    const uniqueNotes = newNotes.filter(note => !isNoteDuplicate(note, existingNotes));
    
    if (uniqueNotes.length === 0) {
      console.log('[DeepSeek] All generated notes were duplicates');
      return [];
    }

    return uniqueNotes;
  } catch (error) {
    console.error('[DeepSeek] Error generating note:', error);
    throw error;
  }
}

export async function shouldCreateNoteWithDeepseek(
  message: { role: string; content: string }
): Promise<boolean> {
  try {
    // 1. Skip if not from assistant
    if (message.role !== 'assistant') {
      console.log('[DeepSeek] Skipping - not from assistant');
      return false;
    }

    // 2. Skip if message is too short
    if (message.content.length < 50) {
      console.log('[DeepSeek] Skipping - message too short');
      return false;
    }

    // 3. Skip if message is purely exploratory
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
      console.log('[DeepSeek] Skipping - purely exploratory questions');
      return false;
    }

    // 4. Check for fundamental concept indicators (relaxed check)
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
      'technique',
      // More general terms to be less restrictive
      'definition',
      'meaning',
      'explanation',
      'understanding',
      'idea',
      'solution',
      'algorithm',
      'formula',
      'equation',
      'rule',
      'property',
      'characteristic',
      'behavior',
      'pattern',
      'relationship',
      'structure',
      'function',
      'purpose',
      'reason',
      'cause',
      'effect',
      'result',
      'implication',
      'application',
      'example',
      'instance',
      'case',
      'scenario'
    ];
    
    // More relaxed check - also allow if message has mathematical content or educational keywords
    const hasFundamentalContent = fundamentalIndicators.some(indicator =>
      message.content.toLowerCase().includes(indicator)
    );
    
    const hasMathContent = /\$[^$]+\$|\\\w+|\d+\s*[=<>]\s*\d+/.test(message.content);
    const hasEducationalKeywords = /learn|understand|explain|solve|calculate|derive|prove|show|demonstrate|analyze|examine|study|explore|investigate/i.test(message.content);
    
    // Pass if any of these conditions are met (much more permissive)
    if (!hasFundamentalContent && !hasMathContent && !hasEducationalKeywords) {
      console.log('[DeepSeek] Skipping - no fundamental concepts, math, or educational content detected');
      return false;
    }

    // If all checks pass, use the LLM as a final filter
    console.log('[DeepSeek] Checking if note should be created...')
    const prompt = `You are a Zettelkasten note-taking assistant. Your job is to determine if the following message contains concepts worth creating notes for.

A message should be converted to notes if it contains ANY of these:
1. Fundamental concepts that are key to understanding a subject
2. Mathematical concepts, formulas, or explanations
3. Definitions or explanations of technical terms
4. Clear explanations of how something works or is structured
5. Relationships between concepts or components
6. Step-by-step explanations of processes or methods
7. Properties or characteristics of systems/concepts
8. Answers to "what is", "how does", or "why" questions
9. Comparisons between different approaches or concepts
10. Core principles or rules in any domain

Content is especially noteworthy if it:
- Contains mathematical notation or formulas
- Explains dimensions, properties, or characteristics
- Defines technical terminology
- Describes relationships between components
- Explains fundamental principles
- Provides clear, concise explanations
- Would be valuable for future reference
- Helps understand other related concepts

Do NOT create notes for:
- Simple yes/no answers without explanation
- Purely exploratory questions without content
- Personal opinions without technical substance
- Vague or incomplete explanations
- Temporary or contextual information
- Questions without answers
- Meta-discussion about the conversation

Respond with just a "YES" if the message contains concepts worth creating notes for, or "NO" if it doesn't.

Message to analyze:
${message.content}`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'Study Assistant'
      },
      body: JSON.stringify({
        model: MODEL_CODE,
        messages: [
          { role: 'system', content: 'You are a Zettelkasten note-taking assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 0.8,
        top_k: 40
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json() as OpenRouterResponse;
    const content = data.choices[0].message.content;
    // Remove \boxed{...} and keep only the content inside
    const cleanedContent = content.replace(/\\boxed\{([^}]+)\}/g, '$1');
    const answer = cleanedContent.trim().toLowerCase();
    console.log('[DeepSeek] Should create note:', answer)
    return answer.includes('yes');
  } catch (error) {
    console.error('[DeepSeek] Error checking if note should be created:', error);
    return false;
  }
} 