import React, { useState } from 'react';
import { Note } from '../types';

interface NotesPanelProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  onDeleteNote: (noteId: string) => Promise<void>;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({ notes, onNoteClick, onDeleteNote }) => {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (noteId: string) => {
    setIsDeleting(noteId);
    try {
      await onDeleteNote(noteId);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="notes-panel">
      <h2>Notes</h2>
      <div className="notes-list">
        {notes.map(note => (
          <div key={note.id} className="note-card">
            <div className="note-header">
              <h3 onClick={() => onNoteClick(note)}>{note.title}</h3>
              <button
                className="delete-btn"
                onClick={() => handleDelete(note.id)}
                disabled={isDeleting === note.id}
              >
                {isDeleting === note.id ? 'Deleting...' : '×'}
              </button>
            </div>
            <p>{note.content}</p>
            <div className="tags">
              {note.tags.map(tag => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotesPanel; 
