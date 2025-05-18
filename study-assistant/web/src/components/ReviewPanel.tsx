import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { SRSManager } from '../utils/srs';
import { marked } from 'marked';

interface ReviewPanelProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  model?: 'openai' | 'local';
}

export const ReviewPanel: React.FC<ReviewPanelProps> = ({ notes, onNoteClick, model = 'openai' }) => {
  const [srsManager] = useState(() => new SRSManager());
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [stats, setStats] = useState<{
    totalNotes: number;
    dueNotes: number;
    averageEasiness: number;
  } | null>(null);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'assistant' | 'system', content: string}[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [disableActions, setDisableActions] = useState(false);

  useEffect(() => {
    srsManager.initializeFromNotes(notes);
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

    setIsLoading(true);
    try {
      // Generate a question based on the note content using LLM
      const getEndpoint = () => model === 'openai' ? '/api/chat' : '/api/chat-local';
      const response = await fetch(`http://localhost:3001${getEndpoint()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: `You are a helpful study assistant. Generate a challenging but fair question to test understanding of the following note. The question should:
1. Test deep understanding rather than just memorization
2. Be clear and specific
3. NOT include the answer or hints
4. Be appropriate for the content level
5. Encourage critical thinking

Note to review:
${note.content}` 
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate question');
      }

      const data = await response.json();
      const question = data.message;
      setCurrentQuestion(question);
      setUserAnswer('');
    } catch (error) {
      console.error('Error generating question:', error);
      setFeedback('Failed to generate question. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    setIsLoading(true);
    setDisableActions(true);
    try {
      const currentNote = srsManager.getCurrentNote();
      const note = notes.find(n => n.id === currentNote?.noteId);
      
      const requestBody = { 
        message: `You are a helpful study assistant providing personalized feedback. Your role is to:
1. Analyze the student's answer thoughtfully
2. Provide constructive feedback that helps them learn
3. Identify misconceptions and explain them clearly
4. Suggest ways to improve understanding
5. Be encouraging and supportive
6. Be ready for follow-up questions
7. Maintain context of the conversation

Original Note Content:
${note?.content}

Question: ${currentQuestion}

Student's Answer: ${userAnswer}

Please provide personalized feedback and be ready for further questions.`,
        history: [
          { 
            role: 'system', 
            content: `You are a helpful study assistant providing personalized feedback. You are discussing the following note:\n\n${note?.content}\n\nKeep this context in mind throughout the conversation.` 
          },
          { role: 'assistant', content: `Here is the question based on the note:\n\n${currentQuestion}` },
          { role: 'user', content: userAnswer }
        ]
      };
      
      console.log('Submitting answer - Request to model:', JSON.stringify(requestBody, null, 2));
      
      const getEndpoint = () => model === 'openai' ? '/api/chat' : '/api/chat-local';
      const response = await fetch(`http://localhost:3001${getEndpoint()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error('Failed to analyze answer');
      }
      const data = await response.json();
      const feedback = data.message;
      setFeedback(feedback);
      setChatHistory([
        { 
          role: 'system', 
          content: `You are a helpful study assistant providing personalized feedback. You are discussing the following note:\n\n${note?.content}\n\nKeep this context in mind throughout the conversation.` 
        },
        { role: 'assistant', content: `Here is the question based on the note:\n\n${currentQuestion}` },
        { role: 'user', content: userAnswer },
        { role: 'assistant', content: feedback }
      ]);
      setIsChatting(true);
      setShowFeedback(true);
    } catch (error) {
      setFeedback('Failed to analyze answer. Please try again.');
      setShowFeedback(true);
    } finally {
      setIsLoading(false);
      setDisableActions(false);
    }
  };

  const handleSkip = () => {
    srsManager.skipCurrentNote();
    generateQuestion();
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const newHistory = [...chatHistory, { role: 'user' as 'user', content: chatInput }];
    setChatHistory(newHistory);
    setIsChatLoading(true);
    setChatInput('');
    try {
      const currentNote = srsManager.getCurrentNote();
      const note = notes.find(n => n.id === currentNote?.noteId);
      
      const requestBody = {
        message: `You are a helpful study assistant. Your role is to:
1. Help students understand complex concepts
2. Provide clear and concise explanations
3. Use examples and analogies when helpful
4. Break down complex topics into simpler parts
5. Check for understanding
6. Be encouraging and supportive
7. Maintain context of the conversation

Current question: ${currentQuestion}

${chatInput}`,
        history: newHistory.map(m => ({ 
          role: m.role as 'user' | 'assistant' | 'system', 
          content: m.content 
        }))
      };
      
      console.log('Sending chat - Request to model:', JSON.stringify(requestBody, null, 2));
      
      const getEndpoint = () => model === 'openai' ? '/api/chat' : '/api/chat-local';
      const response = await fetch(`http://localhost:3001${getEndpoint()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();
      setChatHistory([...newHistory, { role: 'assistant' as const, content: data.message }]);
    } catch (err) {
      setChatHistory([...newHistory, { role: 'assistant' as const, content: 'Sorry, something went wrong.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleContinue = async () => {
    setIsChatting(false);
    setChatHistory([]);
    setShowFeedback(false);
    setUserAnswer('');
    setFeedback(null);
    setDisableActions(false);
    const hasNext = srsManager.moveToNextNote();
    if (hasNext) {
      await generateQuestion();
    } else {
      setIsReviewing(false);
      setFeedback('Review session completed!');
    }
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
      {isLoading && <div className="loading">Processing...</div>}
      {!showFeedback && currentQuestion && (
        <div className="question-container">
          <div className="question" dangerouslySetInnerHTML={{ __html: marked(currentQuestion) }} />
          <textarea
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            placeholder="Type your answer here..."
            rows={4}
            disabled={disableActions}
          />
          <div className="button-group">
            <button onClick={handleSubmit} disabled={!userAnswer.trim() || disableActions}>
              Submit
            </button>
            <button onClick={handleSkip} className="skip-btn" disabled={disableActions}>
              Skip
            </button>
          </div>
        </div>
      )}
      {showFeedback && (
        <div style={{ marginTop: 24 }}>
          <div className="review-chat" style={{ background: '#f8fafc', borderRadius: 12, boxShadow: '0 2px 8px #e0e7ef', padding: 16, marginTop: 8, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
            <div className="question" style={{ fontWeight: 600, fontSize: 17, marginBottom: 10, background: '#f8fafc', borderRadius: 8, padding: 10, border: '1px solid #e5e7eb', wordBreak: 'break-word', whiteSpace: 'pre-line', overflowWrap: 'break-word', maxWidth: '100%' }}
              dangerouslySetInnerHTML={{ __html: marked(currentQuestion || '') }}
            />
            <div style={{ marginBottom: 16 }}>
              {chatHistory.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`} style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user' ? 'linear-gradient(90deg, #6366f1 0%, #818cf8 100%)' : '#f1f5f9',
                  color: msg.role === 'user' ? '#fff' : '#222',
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 6,
                  maxWidth: '90%',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                  overflowWrap: 'break-word',
                  fontSize: 15
                }}
                  dangerouslySetInnerHTML={{ __html: marked(msg.content) }}
                />
              ))}
              {isChatLoading && (
                <div className="message assistant" style={{ background: '#f1f5f9', color: '#222', borderRadius: 8, padding: '10px 14px', marginBottom: 6, maxWidth: '90%' }}>
                  <span className="typing-indicator">
                    <span></span><span></span><span></span>
                  </span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendChat(); }}
                placeholder="Ask a follow-up question..."
                style={{ flex: 1, borderRadius: 8, border: '1px solid #e0e7ef', padding: '8px 12px', fontSize: 15, background: '#fff' }}
                disabled={isChatLoading}
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isChatLoading}
                style={{
                  background: 'linear-gradient(90deg, #6366f1 0%, #818cf8 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: !chatInput.trim() || isChatLoading ? 'not-allowed' : 'pointer',
                  opacity: !chatInput.trim() || isChatLoading ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >Send</button>
            </div>
            <button
              onClick={handleContinue}
              style={{ marginTop: 18, background: '#f1f5f9', border: '1px solid #e0e7ef', borderRadius: 8, padding: '8px 18px', fontWeight: 500, fontSize: 15, color: '#222', cursor: 'pointer', boxShadow: '0 1px 2px #e0e7ef' }}
            >Next Question</button>
          </div>
        </div>
      )}
      {!isReviewing && (
        <>
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
        </>
      )}
    </div>
  );
};

export default ReviewPanel; 