import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { SRSManager } from '../utils/srs';

interface ReviewPanelProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ notes, onNoteClick }) => {
  const [srsManager] = useState(() => new SRSManager());
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [stats, setStats] = useState<{
    totalNotes: number;
    dueNotes: number;
    averageEasiness: number;
  } | null>(null);

  useEffect(() => {
    // Update stats whenever notes change
    setStats(srsManager.getReviewStats());
  }, [notes, srsManager]);

  const startReview = async () => {
    const session = srsManager.startReviewSession(notes);
    if (session.notes.length === 0) {
      setFeedback("No notes are due for review at this time.");
      return;
    }

    setIsReviewing(true);
    setFeedback(null);
    await generateQuestion();
  };

  const generateQuestion = async () => {
    const currentNote = srsManager.getCurrentNote();
    if (!currentNote) {
      setIsReviewing(false);
      setFeedback("Review session completed!");
      return;
    }

    const note = notes.find(n => n.id === currentNote.noteId);
    if (!note) {
      srsManager.skipCurrentNote();
      await generateQuestion();
      return;
    }

    // Generate a question based on the note content
    const question = `Review this note:\n\n${note.content}\n\nWhat are the key points and how do they connect to other concepts you've learned?`;
    setCurrentQuestion(question);
    setUserAnswer('');
  };

  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;

    // Evaluate the answer (simplified version - in a real app, you'd want to use AI for evaluation)
    const score = Math.floor(Math.random() * 5) + 1; // Random score for demo
    srsManager.updateReviewPerformance(score);

    const feedback = score >= 3
      ? "Good answer! You've demonstrated understanding of the concept."
      : "Try to think more deeply about the connections and implications.";

    setFeedback(feedback);

    // Move to next note after a delay
    setTimeout(async () => {
      const hasNext = srsManager.moveToNextNote();
      if (hasNext) {
        await generateQuestion();
      } else {
        setIsReviewing(false);
        setFeedback("Review session completed!");
      }
    }, 2000);
  };

  const handleSkip = () => {
    srsManager.skipCurrentNote();
    generateQuestion();
  };

  if (!isReviewing) {
    return (
      <div className="review-panel">
        <h2>Review Session</h2>
        {stats && (
          <div className="stats">
            <p>Total Notes: {stats.totalNotes}</p>
            <p>Due Notes: {stats.dueNotes}</p>
            <p>Average Easiness: {stats.averageEasiness.toFixed(2)}</p>
          </div>
        )}
        <button
          className="start-review-btn"
          onClick={startReview}
          disabled={!stats?.dueNotes}
        >
          Start Review
        </button>
      </div>
    );
  }

  return (
    <div className="review-panel">
      <h2>Review Session</h2>
      {currentQuestion && (
        <div className="question-container">
          <div className="question">{currentQuestion}</div>
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Type your answer here..."
            rows={4}
          />
          <div className="button-group">
            <button onClick={handleSubmit} disabled={!userAnswer.trim()}>
              Submit
            </button>
            <button onClick={handleSkip} className="skip-btn">
              Skip
            </button>
          </div>
        </div>
      )}
      {feedback && (
        <div className={`feedback ${feedback.includes("Good") ? "positive" : "negative"}`}>
          {feedback}
        </div>
      )}
    </div>
  );
};

export default ReviewPanel; 