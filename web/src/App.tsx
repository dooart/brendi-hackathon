import React, { useState, useEffect, useRef } from 'react';
import { ChatPanel } from './components/ChatPanel';
import NotesPanel from './components/NotesPanel';
import { ZettelkastenView } from './components/ZettelkastenView';
import { ReviewPanel } from './components/ReviewPanel';
import { Message, Note } from './types';
import './App.css';
import './styles/katex.css';
import DocumentsPanel from './components/DocumentsPanel';

function App() {
  const [messages, setMessages] = useState<Message[]>([{
    role: 'assistant',
    content: 'Hello! I\'m your study assistant. How can I help you today?'
  }]);
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'notes' | 'zettelkasten' | 'review' | 'documents'>('chat');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [model, setModel] = useState<'gemini' | 'openai' | 'local' | 'deepseek'>('deepseek');
  const [useRag, setUseRag] = useState(false);
  const [embeddingProvider, setEmbeddingProvider] = useState<'openai' | 'ollama'>('ollama');

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

  const handleSendMessage = async (message: string, model: 'gemini' | 'openai' | 'local' | 'deepseek', useRag: boolean = false) => {
    setIsLoading(true);
    try {
      setMessages(prev => [...prev, { role: 'user', content: message }]);

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: messages,
          model,
          useRag
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const aiResponse = data.response;
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: aiResponse,
        retrievedChunks: data.retrievedChunks
      }]);

      // Call /api/note with the assistant's response
      const noteRes = await fetch('http://localhost:3001/api/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: aiResponse, model })
      });
      if (noteRes.ok) {
        const noteData = await noteRes.json();
        if (noteData.notes && Array.isArray(noteData.notes) && noteData.notes.length > 0) {
          setNotes(prev => [...prev, ...noteData.notes]);
          setMessages(prev => [
            ...prev,
            ...noteData.notes.map((note: any) => ({
              role: 'assistant',
              content: `📝 **Note created:**\n\n**${note.title}**\n\n${note.content}\n\n*Tags: ${note.tags.join(', ')}*`
            }))
          ]);
        }
      }
    } catch (error) {
      console.error('[App] Error sending message:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }]);
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
        <div style={{ margin: '18px 0 18px 0', padding: '0 12px' }}>
          <div style={{ color: '#b0b8c1', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Model</div>
          <select
            value={model}
            onChange={e => setModel(e.target.value as 'gemini' | 'openai' | 'local' | 'deepseek')}
            style={{ width: '100%', padding: 8, borderRadius: 8, background: '#23272f', color: '#e6e6e6', border: '1px solid #4a9eff33', fontSize: 15, marginBottom: 10 }}
          >
            <option value="gemini">Gemini Pro</option>
            <option value="openai">OpenAI (gpt4.1-mini)</option>
            <option value="local">Ollama (phi3:latest)</option>
            <option value="deepseek">DeepSeek</option>
          </select>
          <div style={{ color: '#b0b8c1', fontWeight: 600, fontSize: 14, marginBottom: 6, marginTop: 14 }}>Embedding Provider</div>
          <select
            value={embeddingProvider}
            onChange={e => setEmbeddingProvider(e.target.value as 'openai' | 'ollama')}
            style={{ width: '100%', padding: 8, borderRadius: 8, background: '#23272f', color: '#e6e6e6', border: '1px solid #4a9eff33', fontSize: 15 }}
          >
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (e5-base-v2)</option>
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
          <button
            className={activeTab === 'documents' ? 'active' : ''}
            onClick={() => setActiveTab('documents')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
            Documents
          </button>
        </nav>
      </div>
      <div className="main-content">
        {activeTab === 'chat' && (
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSendMessage={(msg, mdl, useRag) => handleSendMessage(msg, mdl, useRag)}
            messagesEndRef={messagesEndRef}
            model={model}
            embeddingProvider={embeddingProvider}
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
        {activeTab === 'documents' && (
          <DocumentsPanel embeddingProvider={embeddingProvider} />
        )}
      </div>
    </div>
  );
}

export default App; 