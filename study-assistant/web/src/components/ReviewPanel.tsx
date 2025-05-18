import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { SRSManager } from '../utils/srs';
import { marked } from 'marked';
import { MarkdownRenderer } from './MarkdownRenderer';

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
8. IMPORTANT: When outputting mathematical expressions, always use $...$ for inline math and $$...$$ for block math, following standard Markdown+LaTeX conventions, instead of simple markdown. Do NOT use [ ... ], ( ... ), or \\( ... \\) for math. For example: Inline: $x = 2y + 1$. Block: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$. Always ensure all math is properly delimited for Markdown rendering.\n\nOriginal Note Content:\n${note?.content}\n\nQuestion: ${currentQuestion}\n\nStudent's Answer: ${userAnswer}\n\nPlease provide personalized feedback and be ready for further questions.`,
        history: [
          { 
            role: 'system', 
            content: `You are a helpful study assistant providing personalized feedback. You are discussing the following note:\n\n${note?.content}\n\nKeep this context in mind throughout the conversation.\n\nIMPORTANT: When outputting mathematical expressions, always use $...$ for inline math and $$...$$ for block math, following standard Markdown+LaTeX conventions. Do NOT use [ ... ], ( ... ), or \\( ... \\) for math. For example: Inline: $x = 2y + 1$. Block: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$. Always ensure all math is properly delimited for Markdown rendering.` 
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
8. IMPORTANT: When outputting mathematical expressions, always use $...$ for inline math and $$...$$ for block math, following standard Markdown+LaTeX conventions. Do NOT use [ ... ], ( ... ), or \\( ... \\) for math. For example: Inline: $x = 2y + 1$. Block: $$\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$$. Always ensure all math is properly delimited for Markdown rendering.\n\nCurrent question: ${currentQuestion}\n\n${chatInput}`,
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

  const handleNext = async () => {
    setShowFeedback(false);
    setFeedback(null);
    setUserAnswer('');
    setDisableActions(false);
    setIsChatting(false);
    setChatHistory([]);
    const hasNext = srsManager.moveToNextNote();
    if (hasNext) {
      await generateQuestion();
    } else {
      setIsReviewing(false);
      setFeedback('Review session completed!');
    }
  };

  const handleShowChat = () => {
    setIsChatting(true);
  };

  // Modern progress bar
  const session = srsManager.getCurrentSession();
  const currentNoteIndex = session ? session.currentNoteIndex + 1 : 0;
  const total = session ? session.notes.length : 0;
  const progress = total > 0 ? (currentNoteIndex / total) * 100 : 0;
  const performance = session ? session.performance : { correct: 0, incorrect: 0, skipped: 0 };

  if (!isReviewing) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(120deg, #23272f 0%, #181c20 100%)', padding: '40px 0' }}>
        <div style={{
          maxWidth: 480,
          width: '100%',
          background: 'rgba(35,39,47,0.98)',
          borderRadius: 28,
          boxShadow: '0 8px 32px #4a9eff22',
          padding: '38px 36px 32px 36px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
        }}>
          <h1 style={{ color: '#7f53ff', fontWeight: 800, fontSize: 28, margin: 0, letterSpacing: -1, marginBottom: 8 }}>Review Session</h1>
          <div style={{ width: '100%', marginBottom: 8 }}>
            <div style={{ color: '#b0b8c1', fontWeight: 600, fontSize: 17, marginBottom: 8 }}>Spaced Repetition Review</div>
            <div style={{ width: '100%', height: 8, background: '#23273a', borderRadius: 8, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${stats && stats.totalNotes > 0 ? (stats.dueNotes / stats.totalNotes) * 100 : 0}%`, height: '100%', background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)', borderRadius: 8, transition: 'width 0.3s' }} />
            </div>
            <div style={{ color: '#b0b8c1', fontWeight: 500, fontSize: 15, marginTop: 4 }}>
              {stats ? `${stats.dueNotes} due / ${stats.totalNotes} total notes` : 'No notes found.'}
            </div>
            <div style={{ color: '#4a9eff', fontWeight: 700, fontSize: 15, marginTop: 2 }}>
              Avg. Easiness: {stats ? stats.averageEasiness.toFixed(2) : '--'}
            </div>
          </div>
          <button
            onClick={startReview}
            disabled={!stats?.dueNotes}
            style={{
              width: '100%',
              borderRadius: 16,
              padding: '18px 0',
              fontSize: 20,
              fontWeight: 800,
              background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 8px #4a9eff22',
              cursor: !stats?.dueNotes ? 'not-allowed' : 'pointer',
              opacity: !stats?.dueNotes ? 0.6 : 1,
              marginTop: 18,
              marginBottom: 0,
              transition: 'opacity 0.2s',
            }}
          >Start Review</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(120deg, #23272f 0%, #181c20 100%)', padding: '40px 0' }}>
      <div style={{
        maxWidth: 540,
        width: '100%',
        background: 'rgba(35,39,47,0.98)',
        borderRadius: 28,
        boxShadow: '0 8px 32px #4a9eff22',
        padding: '38px 36px 32px 36px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 28,
      }}>
        {/* Header and Progress */}
        <div style={{ width: '100%', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <h1 style={{ color: '#7f53ff', fontWeight: 800, fontSize: 28, margin: 0, letterSpacing: -1 }}>Review Session</h1>
            <span style={{ color: '#b0b8c1', fontWeight: 600, fontSize: 16 }}>{currentNoteIndex} / {total}</span>
          </div>
          <div style={{ width: '100%', height: 8, background: '#23273a', borderRadius: 8, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)', borderRadius: 8, transition: 'width 0.3s' }} />
          </div>
        </div>
        {/* Question */}
        {currentQuestion && (
          <div style={{
            width: '100%',
            background: 'linear-gradient(90deg, #23273a 0%, #23272f 100%)',
            borderRadius: 16,
            padding: '22px 20px',
            color: '#e6e6e6',
            fontSize: 19,
            fontWeight: 600,
            marginBottom: 0,
            boxShadow: '0 2px 12px #4a9eff11',
            minHeight: 60,
            whiteSpace: 'pre-line',
          }}
            dangerouslySetInnerHTML={{ __html: marked(currentQuestion) }}
          />
        )}
        {/* Answer input */}
        {!showFeedback && (
          <textarea
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            placeholder="Type your answer..."
            disabled={isLoading}
            style={{
              width: '100%',
              minHeight: 90,
              fontSize: 17,
              borderRadius: 14,
              border: '1.5px solid #4a9eff33',
              background: '#181c20',
              color: '#e6e6e6',
              padding: '14px 18px',
              marginTop: 8,
              marginBottom: 0,
              outline: 'none',
              fontWeight: 500,
              boxShadow: '0 2px 8px #4a9eff11',
              resize: 'vertical',
              transition: 'border 0.2s, box-shadow 0.2s',
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                handleSubmit();
              }
              // Shift+Enter, Ctrl+Enter, or Cmd+Enter insert newline (default)
            }}
          />
        )}
        {/* Submit/Next Buttons */}
        <div style={{ width: '100%', display: 'flex', gap: 14, marginTop: 2 }}>
          {!showFeedback ? (
            <button
              onClick={handleSubmit}
              disabled={isLoading || !userAnswer.trim()}
              style={{
                flex: 1,
                borderRadius: 14,
                padding: '14px 0',
                fontSize: 18,
                fontWeight: 700,
                background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                color: '#fff',
                border: 'none',
                boxShadow: '0 2px 8px #4a9eff22',
                cursor: isLoading || !userAnswer.trim() ? 'not-allowed' : 'pointer',
                opacity: isLoading || !userAnswer.trim() ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}
            >{isLoading ? 'Checking...' : 'Submit'}</button>
          ) : (
            <>
              <button
                onClick={handleNext}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  padding: '14px 0',
                  fontSize: 18,
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 2px 8px #4a9eff22',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >Next</button>
              <button
                onClick={handleShowChat}
                style={{
                  flex: 1,
                  borderRadius: 14,
                  padding: '14px 0',
                  fontSize: 18,
                  fontWeight: 700,
                  background: 'linear-gradient(90deg, #7f53ff 0%, #4a9eff 100%)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 2px 8px #7f53ff22',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
              >Ask Follow-up</button>
            </>
          )}
          <button
            onClick={handleSkip}
            disabled={isLoading}
            style={{
              borderRadius: 14,
              padding: '14px 0',
              fontSize: 17,
              fontWeight: 600,
              background: 'none',
              color: '#ff5c5c',
              border: '2px solid #ff5c5c',
              boxShadow: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              flex: 0.7,
              transition: 'opacity 0.2s',
            }}
          >Skip</button>
        </div>
        {/* Feedback */}
        {showFeedback && feedback && !isChatting && (
          <div style={{
            width: '100%',
            background: feedback.toLowerCase().includes('correct') ? 'linear-gradient(90deg, #22c55e 0%, #4a9eff 100%)' : 'linear-gradient(90deg, #ff5c5c 0%, #7f53ff 100%)',
            color: '#fff',
            borderRadius: 16,
            padding: '22px 20px',
            fontSize: 18,
            fontWeight: 600,
            marginTop: 10,
            boxShadow: '0 2px 12px #4a9eff22',
            minHeight: 60,
            whiteSpace: 'pre-line',
            animation: 'fadeIn 0.3s',
          }}>
            <MarkdownRenderer content={feedback} />
          </div>
        )}
        {/* Chat Interface */}
        {isChatting && (
          <div style={{ width: '100%', marginTop: 18 }}>
            <div style={{
              background: '#23273a',
              borderRadius: 14,
              padding: '18px 18px 12px 18px',
              marginBottom: 10,
              color: '#e6e6e6',
              fontSize: 16,
              fontWeight: 500,
              minHeight: 40,
              boxShadow: '0 2px 8px #4a9eff11',
            }}>
              {chatHistory.map((msg, idx) => (
                <div key={idx} style={{
                  marginBottom: 8,
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  background: msg.role === 'user' ? 'linear-gradient(90deg, #6366f1 0%, #818cf8 100%)' : '#353b48',
                  color: msg.role === 'user' ? '#fff' : '#e6e6e6',
                  borderRadius: 10,
                  padding: '8px 12px',
                  maxWidth: '90%',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-line',
                  overflowWrap: 'break-word',
                  fontSize: 15
                }}>
                  {msg.role === 'assistant' ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    msg.content
                  )}
                </div>
              ))}
              {isChatLoading && (
                <div style={{ background: '#353b48', color: '#e6e6e6', borderRadius: 10, padding: '8px 12px', marginBottom: 6, maxWidth: '90%' }}>
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
                style={{ flex: 1, borderRadius: 10, border: '1px solid #4a9eff33', padding: '10px 14px', fontSize: 15, background: '#181c20', color: '#e6e6e6' }}
                disabled={isChatLoading}
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isChatLoading}
                style={{
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontWeight: 600,
                  fontSize: 15,
                  background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 2px 8px #4a9eff22',
                  cursor: !chatInput.trim() || isChatLoading ? 'not-allowed' : 'pointer',
                  opacity: !chatInput.trim() || isChatLoading ? 0.7 : 1,
                  transition: 'opacity 0.2s',
                }}
              >Send</button>
            </div>
          </div>
        )}
        {/* Session Stats Floating Card */}
        <div style={{
          position: 'absolute',
          top: 18,
          right: 24,
          background: 'rgba(36,40,48,0.92)',
          borderRadius: 14,
          boxShadow: '0 2px 12px #7f53ff22',
          padding: '14px 22px',
          zIndex: 10,
          border: '1.5px solid #4a9eff33',
          backdropFilter: 'blur(6px)',
          minWidth: 120,
          color: '#e6e6e6',
          fontSize: 15,
          fontWeight: 600,
        }}>
          <div style={{ color: '#7f53ff', fontWeight: 800, fontSize: 16, marginBottom: 6, letterSpacing: -0.5 }}>Session Stats</div>
          <div>Correct: {performance.correct}</div>
          <div>Incorrect: {performance.incorrect}</div>
          <div>Skipped: {performance.skipped}</div>
          <div style={{ color: '#4a9eff', fontWeight: 700, marginTop: 4 }}>Accuracy: {total > 0 ? `${((performance.correct / total) * 100).toFixed(1)}%` : '0%'}</div>
        </div>
      </div>
    </div>
  );
};

export default ReviewPanel; 