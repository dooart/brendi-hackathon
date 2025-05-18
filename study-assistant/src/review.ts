import { Note } from './notes';
import { SRSManager, ReviewSession } from './srs';
import { NoteDatabase } from './database';
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const reviewResponseSchema = z.object({
  question: z.string().describe("The question to ask the user about the note"),
  expectedAnswer: z.string().describe("The expected answer to the question"),
  explanation: z.string().describe("Explanation of why this is the correct answer"),
  followUpQuestions: z.array(z.string()).describe("Additional questions to ask if the user's answer is incorrect"),
  newNote: z.string().optional().describe("A new note to create based on the user's response, if relevant")
});

const evaluationSchema = z.object({
  isCorrect: z.boolean().describe("Whether the user's answer is correct"),
  score: z.number().min(0).max(5).describe("Score from 0-5 of how well the user answered"),
  feedback: z.string().describe("Feedback on the user's answer"),
  followUpQuestion: z.string().optional().describe("A follow-up question to ask, if needed"),
  newNote: z.string().optional().describe("A new note to create based on the user's response, if relevant")
});

export class ReviewMode {
  private srsManager: SRSManager;
  private db: NoteDatabase;
  private currentSession: ReviewSession | null;
  private currentNote: Note | null;

  constructor(db: NoteDatabase) {
    this.srsManager = new SRSManager();
    this.db = db;
    this.currentSession = null;
    this.currentNote = null;
  }

  public async startReview(): Promise<string> {
    const notes = this.db.getAllNotes();
    if (notes.length === 0) {
      return "No notes available for review.";
    }

    this.currentSession = this.srsManager.startReviewSession(notes);
    if (this.currentSession.notes.length === 0) {
      return "No notes are due for review at this time.";
    }

    const stats = this.srsManager.getReviewStats();
    return `Starting review session with ${this.currentSession.notes.length} notes.\n` +
           `Total notes: ${stats.totalNotes}\n` +
           `Due notes: ${stats.dueNotes}\n` +
           `Average easiness: ${stats.averageEasiness.toFixed(2)}`;
  }

  public async getNextQuestion(): Promise<string | null> {
    if (!this.currentSession) {
      return null;
    }

    const currentState = this.srsManager.getCurrentNote();
    if (!currentState) {
      return null;
    }

    this.currentNote = this.db.getNote(currentState.noteId);
    if (!this.currentNote) {
      this.srsManager.skipCurrentNote();
      return this.getNextQuestion();
    }

    const { object } = await generateObject({
      model: openai("gpt-4o-mini-2024-07-18"),
      system: `You are a helpful study assistant. Create a question to test the user's understanding of the following note. 
               The question should be challenging but fair, and should test deep understanding rather than just memorization.
               If the user's response reveals a gap in understanding, suggest a new note to create that would help clarify the concept.`,
      prompt: `Note to review:\nTitle: ${this.currentNote.title}\nContent: ${this.currentNote.content}\nTags: ${this.currentNote.tags.join(', ')}`,
      schema: reviewResponseSchema
    });

    return object.question;
  }

  public async evaluateAnswer(answer: string): Promise<{
    feedback: string;
    isCorrect: boolean;
    score: number;
    followUpQuestion?: string;
    newNote?: string;
  }> {
    if (!this.currentNote) {
      throw new Error("No active note for evaluation");
    }

    const { object } = await generateObject({
      model: openai("gpt-4o-mini-2024-07-18"),
      system: `You are a Zettelkasten review assistant. Evaluate the user's answer about the note and consider creating new atomic notes.

Guidelines for evaluation:
1. Assess understanding of the core atomic idea
2. Look for new insights that could become separate notes
3. Identify potential connections to other concepts
4. Evaluate clarity and precision of expression

Guidelines for new notes:
1. Only create a new note if the user's answer contains a genuinely new, atomic insight
2. The new insight must be:
   - A complete thought that stands on its own
   - Specific and precise
   - Different from the original note
   - Valuable for future reference
3. Do NOT create notes for:
   - Generic or obvious statements
   - Simple rephrasing of the original note
   - Examples or applications without new insights
   - Incomplete thoughts or questions

If there is no new atomic insight, leave newNote empty or undefined.`,
      prompt: `Note: ${this.currentNote.content}\nUser's answer: ${answer}`,
      schema: evaluationSchema
    });

    // Update SRS state based on performance
    this.srsManager.updateReviewPerformance(object.score);

    // Only save a new note if it meets Zettelkasten criteria
    if (object.newNote &&
        object.newNote.trim().length > 0 &&
        object.newNote.trim() !== this.currentNote.content.trim()) {
      
      // Generate a unique ID that includes a timestamp and random string
      const uniqueId = `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const newNote: Note = {
        id: uniqueId,
        title: `Insight from "${this.currentNote.title}"`,
        content: object.newNote,
        tags: [...this.currentNote.tags, 'review-insight'],
        relatedNotes: [this.currentNote.id],
        createdAt: new Date(),
        lastModified: new Date(),
        source: {
          conversationId: 'review-session',
          messageIndex: 0
        }
      };
      this.db.saveNote(newNote);
    }

    return {
      feedback: object.feedback,
      isCorrect: object.isCorrect,
      score: object.score,
      followUpQuestion: object.followUpQuestion
    };
  }

  public async moveToNextNote(): Promise<boolean> {
    const hasNext = this.srsManager.moveToNextNote();
    if (!hasNext) {
      const session = this.srsManager.endReviewSession();
      return false;
    }
    return true;
  }

  public getSessionStats(): string {
    if (!this.currentSession) {
      return "No active review session.";
    }

    const { performance } = this.currentSession;
    const total = performance.correct + performance.incorrect + performance.skipped;
    const accuracy = total > 0 ? (performance.correct / total * 100).toFixed(1) : "0";

    return `Session Progress:\n` +
           `Correct: ${performance.correct}\n` +
           `Incorrect: ${performance.incorrect}\n` +
           `Skipped: ${performance.skipped}\n` +
           `Accuracy: ${accuracy}%`;
  }
} 