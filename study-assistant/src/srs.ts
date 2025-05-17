import { Note } from './notes';

// SRS algorithm constants (SuperMemo-2 algorithm)
const MIN_EASINESS = 1.3;
const INITIAL_EASINESS = 2.5;
const INITIAL_INTERVAL = 1;
const SECOND_INTERVAL = 6;

export type ReviewState = {
  noteId: string;
  nextReview: Date;
  interval: number;
  easiness: number;
  repetitions: number;
  lastReview: Date | null;
  lastPerformance: number | null;
};

export type ReviewSession = {
  id: string;
  startTime: Date;
  endTime: Date | null;
  notes: ReviewState[];
  currentNoteIndex: number;
  performance: {
    correct: number;
    incorrect: number;
    skipped: number;
  };
};

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

  public initializeNote(noteId: string): void {
    if (!this.reviewStates.has(noteId)) {
      this.reviewStates.set(noteId, {
        noteId,
        nextReview: new Date(),
        interval: INITIAL_INTERVAL,
        easiness: INITIAL_EASINESS,
        repetitions: 0,
        lastReview: null,
        lastPerformance: null
      });
    }
  }

  public getNotesForReview(notes: Note[]): Note[] {
    const now = new Date();
    return notes.filter(note => {
      const state = this.reviewStates.get(note.id);
      if (!state) {
        this.initializeNote(note.id);
        return true;
      }
      return state.nextReview <= now;
    });
  }

  public startReviewSession(notes: Note[]): ReviewSession {
    const notesForReview = this.getNotesForReview(notes);
    
    this.currentSession = {
      id: `review_${Date.now()}`,
      startTime: new Date(),
      endTime: null,
      notes: notesForReview.map(note => this.reviewStates.get(note.id) || {
        noteId: note.id,
        nextReview: new Date(),
        interval: INITIAL_INTERVAL,
        easiness: INITIAL_EASINESS,
        repetitions: 0,
        lastReview: null,
        lastPerformance: null
      }),
      currentNoteIndex: 0,
      performance: {
        correct: 0,
        incorrect: 0,
        skipped: 0
      }
    };

    return this.currentSession;
  }

  public updateReviewPerformance(performance: number): void {
    if (!this.currentSession) return;

    const currentNote = this.currentSession.notes[this.currentSession.currentNoteIndex];
    if (!currentNote) return;

    // Update performance tracking
    if (performance >= 3) {
      this.currentSession.performance.correct++;
    } else {
      this.currentSession.performance.incorrect++;
    }

    // Update SRS state
    const newState = calculateNextReview(currentNote, performance);
    this.reviewStates.set(currentNote.noteId, newState);
    this.currentSession.notes[this.currentSession.currentNoteIndex] = newState;
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