import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { NotesPanel } from './components/NotesPanel';
import './App.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Note {
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

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotes = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/notes');
      if (!response.ok) {
        throw new Error('Failed to fetch notes');
      }
      const data = await response.json();
      setNotes(data.notes);
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

      // Remove the note from the local state
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
      // You might want to show an error message to the user here
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: input }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = { role: 'assistant', content: data.message };
      setMessages(prev => [...prev, assistantMessage]);

      // Check if a note was created
      if (data.note) {
        const noteMessage: Message = {
          role: 'assistant',
          content: `📝 **New Note Created!**\n\n**${data.note.title}**\n${data.note.content}\n\nTags: ${data.note.tags.join(', ')}`
        };
        setMessages(prev => [...prev, noteMessage]);
        // Refresh notes after creating a new one
        fetchNotes();
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add initial welcome message
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: `Welcome to the Study Assistant! I can help you with your studies and automatically create notes from our conversation when I detect important information.

The notes will be displayed in the chat with proper formatting and tags. You can continue our conversation naturally, and I'll create notes when I identify key concepts, definitions, or important information.`
    }]);
  }, []);

  return (
    <div className="app">
      <NotesPanel notes={notes} onDeleteNote={handleDeleteNote} />
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              {message.role === 'assistant' ? (
                <ReactMarkdown>{message.content}</ReactMarkdown>
              ) : (
                message.content
              )}
            </div>
          ))}
          {isLoading && (
            <div className="message assistant typing">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
        </div>
        <form className="input-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading}
          />
          <button type="submit" className="send-button" disabled={isLoading}>
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App; 