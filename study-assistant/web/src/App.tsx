import React, { useState, useEffect, useRef } from 'react';
import { ChatPanel } from './components/ChatPanel';
import NotesPanel from './components/NotesPanel';
import { ZettelkastenView } from './components/ZettelkastenView';
import { Message, Note } from './types';
import './App.css';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'zettelkasten'>('chat');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

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

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    setIsLoading(true);
    try {
      const newMessage: Message = { role: 'user', content: message };
      setMessages(prev => [...prev, newMessage]);

      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = { role: 'assistant', content: data.response };
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

  // Add initial welcome message
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: `Welcome to the Study Assistant! I can help you with your studies and automatically create notes from our conversation when I detect important information.

The notes will be displayed in the chat with proper formatting and tags. You can continue our conversation naturally, and I'll create notes when I identify key concepts, definitions, or important information.`
    }]);
  }, []);

  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
  };

  return (
    <div className="app">
      <div className="sidebar">
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`tab-button ${activeTab === 'zettelkasten' ? 'active' : ''}`}
            onClick={() => setActiveTab('zettelkasten')}
          >
            Zettelkasten
          </button>
        </div>
        
        {activeTab === 'chat' ? (
          <ChatPanel
            messages={messages}
            isLoading={isLoading}
            onSendMessage={handleSendMessage}
            messagesEndRef={messagesEndRef}
          />
        ) : (
          <ZettelkastenView
            notes={notes}
            onNoteClick={handleNoteClick}
          />
        )}
      </div>
      
      <div className="main-content">
        <NotesPanel
          notes={notes}
          onDeleteNote={handleDeleteNote}
          selectedNoteId={selectedNoteId}
          onSelectNote={setSelectedNoteId}
        />
      </div>
    </div>
  );
}

export default App; 