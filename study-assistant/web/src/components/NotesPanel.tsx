import React from 'react';
import ReactMarkdown from 'react-markdown';

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

interface NotesPanelProps {
  notes: Note[];
  onDeleteNote: (noteId: string) => Promise<void>;
}

export function NotesPanel({ notes, onDeleteNote }: NotesPanelProps) {
  const [deletingNoteId, setDeletingNoteId] = React.useState<string | null>(null);

  const handleDelete = async (noteId: string) => {
    try {
      setDeletingNoteId(noteId);
      await onDeleteNote(noteId);
    } finally {
      setDeletingNoteId(null);
    }
  };

  return (
    <div className="notes-panel">
      <h2>Study Notes</h2>
      <div className="notes-list">
        {notes.length === 0 ? (
          <p className="no-notes">No notes yet. Start chatting to create notes!</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="note-card">
              <div className="note-header">
                <h3>{note.title}</h3>
                <button
                  className="delete-button"
                  onClick={() => handleDelete(note.id)}
                  disabled={deletingNoteId === note.id}
                >
                  {deletingNoteId === note.id ? 'Deleting...' : '×'}
                </button>
              </div>
              <div className="note-content">
                <ReactMarkdown>{note.content}</ReactMarkdown>
              </div>
              <div className="note-tags">
                {note.tags.map((tag) => (
                  <span key={tag} className="tag">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="note-date">
                Created: {new Date(note.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 