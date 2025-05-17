export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

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

export interface ReviewState {
  noteId: string;
  nextReview: Date;
  interval: number;
  easiness: number;
  repetitions: number;
  lastReview: Date | null;
  lastPerformance: number | null;
}

export interface ReviewSession {
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
} 