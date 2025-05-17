import React from 'react';
import { Note } from '../types';

interface NotesPanelProps {
  notes: Note[];
  onDeleteNote: (noteId: string) => void;
  selectedNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  onDeleteNote,
  selectedNoteId,
  onSelectNote,
}) => {
  return (
    <div className="notes-panel">
      <h2>Notes</h2>
      <div className="notes-list">
        {notes.length === 0 ? (
          <div className="no-notes">No notes yet</div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`note-card ${selectedNoteId === note.id ? 'selected' : ''}`}
              onClick={() => onSelectNote(note.id)}
            >
              <div className="note-header">
                <h3>{note.title}</h3>
                <button
                  className="delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteNote(note.id);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="note-content">{note.content}</div>
              <div className="note-tags">
                {note.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="note-date">
                {new Date(note.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotesPanel; 
