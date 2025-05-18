import { Note, ReviewState, ReviewSession } from '../types';

// SRS algorithm constants (SuperMemo-2 algorithm)
const MIN_EASINESS = 1.3;
const INITIAL_EASINESS = 2.5;
const INITIAL_INTERVAL = 1;
const SECOND_INTERVAL = 6;

// Calculate next review date using SuperMemo-2 algorithm
const calculateNextReview = (
  currentState: ReviewState,
  performance: number
): ReviewState => {
  const newEasiness = Math.max(
    MIN_EASINESS,
    currentState.easiness + (0.1 - (5 - performance) * (0.08 + (5 - performance) * 0.02))
  );

  let newInterval: number;
  if (currentState.repetitions === 0) {
    newInterval = INITIAL_INTERVAL;
  } else if (currentState.repetitions === 1) {
    newInterval = SECOND_INTERVAL;
  } else {
    newInterval = Math.round(currentState.interval * newEasiness);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return {
    ...currentState,
    nextReview,
    interval: newInterval,
    easiness: newEasiness,
    repetitions: currentState.repetitions + 1,
    lastReview: new Date(),
    lastPerformance: performance
  };
};

export class SRSManager {
  private reviewStates: Map<string, ReviewState>;
  private currentSession: ReviewSession | null;

  constructor() {
    this.reviewStates = new Map();
    this.currentSession = null;
  }

  // Initialize review state from backend SRS fields in notes
  public initializeFromNotes(notes: Note[]): void {
    this.reviewStates.clear();
    console.log('Initializing review states from notes:', notes);
    for (const note of notes) {
      this.reviewStates.set(note.id, {
        noteId: note.id,
        nextReview: note.nextReview ? new Date(note.nextReview) : new Date(),
        interval: note.interval ?? 1,
        easiness: note.easiness ?? 2.5,
        repetitions: note.repetitions ?? 0,
        lastReview: note.lastReview ? new Date(note.lastReview) : null,
        lastPerformance: note.lastPerformance ?? null
      });
    }
    console.log('Review states after initialization:', Array.from(this.reviewStates.entries()));
  }

  public getNotesForReview(notes: Note[]): Note[] {
    const now = new Date();
    console.log('getNotesForReview called with notes:', notes);
    const dueNotes = notes.filter(note => {
      const state = this.reviewStates.get(note.id);
      if (!state) {
        console.log('Note not initialized:', note.id);
        return true;
      }
      const isDue = state.nextReview <= now;
      console.log('Note due check:', note.id, isDue, state.nextReview);
      return isDue;
    });
    console.log('Due notes:', dueNotes);
    return dueNotes;
  }

  public startReviewSession(notes: Note[]): ReviewSession {
    this.initializeFromNotes(notes);
    const notesForReview = this.getNotesForReview(notes);
    this.currentSession = {
      id: `review_${Date.now()}`,
      startTime: new Date(),
      endTime: null,
      notes: notesForReview.map(note => this.reviewStates.get(note.id)!),
      currentNoteIndex: 0,
      performance: {
        correct: 0,
        incorrect: 0,
        skipped: 0
      }
    };
    return this.currentSession;
  }

  public updateReviewPerformance(performance: number): ReviewState | undefined {
    if (!this.currentSession) return;
    const currentNote = this.currentSession.notes[this.currentSession.currentNoteIndex];
    if (!currentNote) return;
    if (performance >= 3) {
      this.currentSession.performance.correct++;
    } else {
      this.currentSession.performance.incorrect++;
    }
    const newState = calculateNextReview(currentNote, performance);
    this.reviewStates.set(currentNote.noteId, newState);
    this.currentSession.notes[this.currentSession.currentNoteIndex] = newState;
    return newState;
  }

  public skipCurrentNote(): void {
    if (!this.currentSession) return;
    this.currentSession.performance.skipped++;
  }

  public getCurrentNote(): ReviewState | null {
    if (!this.currentSession) return null;
    return this.currentSession.notes[this.currentSession.currentNoteIndex] || null;
  }

  public moveToNextNote(): boolean {
    if (!this.currentSession) return false;
    
    this.currentSession.currentNoteIndex++;
    return this.currentSession.currentNoteIndex < this.currentSession.notes.length;
  }

  public endReviewSession(): ReviewSession {
    if (!this.currentSession) {
      throw new Error("No active review session");
    }

    this.currentSession.endTime = new Date();
    const session = this.currentSession;
    this.currentSession = null;
    return session;
  }

  public getReviewStats(): {
    totalNotes: number;
    dueNotes: number;
    averageEasiness: number;
  } {
    const states = Array.from(this.reviewStates.values());
    const now = new Date();
    
    return {
      totalNotes: states.length,
      dueNotes: states.filter(state => state.nextReview <= now).length,
      averageEasiness: states.reduce((sum, state) => sum + state.easiness, 0) / states.length
    };
  }
} 