import React, { useState, useEffect, useRef } from 'react';
import { ChatPanel } from './components/ChatPanel';
import NotesPanel from './components/NotesPanel';
import { ZettelkastenView } from './components/ZettelkastenView';
import { ReviewPanel } from './components/ReviewPanel';
import { Message, Note } from './types';
import './App.css';

function App() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: `Welcome to the Study Assistant! I can help you with your studies and automatically create notes from our conversation when I detect important information.

The notes will be displayed in the chat with proper formatting and tags. You can continue our conversation naturally, and I'll create notes when I identify key concepts, definitions, or important information.`
  }]);
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'zettelkasten' | 'review'>('chat');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [model, setModel] = useState<'openai' | 'local'>('openai');

  const fetchNotes = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/notes');
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      const data = await response.json();
      const parsedNotes = data.notes.map((note: any) => ({
        ...note,
        nextReview: note.nextReview ? new Date(note.nextReview) : undefined,
        lastReview: note.lastReview ? new Date(note.lastReview) : undefined,
        createdAt: new Date(note.createdAt),
        lastModified: new Date(note.lastModified),
      }));
      setNotes(parsedNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/notes/${noteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete note');
      }

      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
      if (selectedNoteId === noteId) {
        setSelectedNoteId(null);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleSendMessage = async (message: string, model: 'openai' | 'local') => {
    if (!message.trim()) return;
    setIsLoading(true);
    try {
      const userMessage: Message = { role: 'user', content: message };
      setMessages(prev => [...prev, userMessage]);
      const endpoint = model === 'openai' ? '/api/chat' : '/api/chat-local';
      
      const requestBody = { 
        message,
        history: messages.map(m => ({ role: m.role, content: m.content }))
      };
      
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      const data = await response.json();
      const newMessages: Message[] = [];
      const assistantMessage: Message = { role: 'assistant', content: data.message };
      newMessages.push(assistantMessage);
      if (data.note) {
        const noteMessage: Message = {
          role: 'assistant',
          content: `📝 **New Note Created!**\n\n**${data.note.title}**\n${data.note.content}\n\nTags: ${data.note.tags.join(', ')}`
        };
        newMessages.push(noteMessage);
        fetchNotes();
      }
      setMessages(prev => [...prev, ...newMessages]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="logo">Study Assistant</div>
        <div style={{ margin: '18px 0 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <label htmlFor="model-select" style={{ fontWeight: 500, fontSize: 14, color: '#b0b8c1', marginBottom: 2 }}>Model</label>
          <select
            id="model-select"
            value={model}
            onChange={e => setModel(e.target.value as 'openai' | 'local')}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              background: '#23272f',
              color: '#e6e6e6',
              border: '1px solid #4a9eff33',
              fontSize: 15,
              fontWeight: 500,
              outline: 'none',
              width: '100%',
              marginTop: 0
            }}
          >
            <option value="openai">OpenAI (gpt4.1-mini)</option>
            <option value="local">Local (Ollama)</option>
          </select>
        </div>
        <nav>
          <button
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Chat
          </button>
          <button
            className={activeTab === 'notes' ? 'active' : ''}
            onClick={() => setActiveTab('notes')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            Notes
          </button>
          <button
            className={activeTab === 'zettelkasten' ? 'active' : ''}
            onClick={() => setActiveTab('zettelkasten')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Zettelkasten
          </button>
          <button
            className={activeTab === 'review' ? 'active' : ''}
            onClick={() => setActiveTab('review')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Review
          </button>
        </nav>
      </div>
      <div className="main-content">
        {activeTab === 'chat' && (
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSendMessage={msg => handleSendMessage(msg, model)}
            messagesEndRef={messagesEndRef}
            model={model}
          />
        )}
        {activeTab === 'notes' && (
          <NotesPanel
            notes={notes}
            onNoteClick={handleNoteClick}
            onDeleteNote={handleDeleteNote}
          />
        )}
        {activeTab === 'zettelkasten' && (
          <ZettelkastenView
            notes={notes}
            onNoteClick={handleNoteClick}
          />
        )}
        {activeTab === 'review' && (
          <ReviewPanel
            notes={notes}
            onNoteClick={handleNoteClick}
            model={model}
          />
        )}
      </div>
    </div>
  );
}

export default App; 