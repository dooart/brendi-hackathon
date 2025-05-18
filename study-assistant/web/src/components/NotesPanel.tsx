import React, { useState } from 'react';
import { Note } from '../types';

interface NotesPanelProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  onDeleteNote: (noteId: string) => Promise<void>;
}

const NotesPanel: React.FC<NotesPanelProps> = ({ notes, onNoteClick, onDeleteNote }) => {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [modalNote, setModalNote] = useState<Note | null>(null);

  // Filter notes by search and tag
  const filteredNotes = notes.filter(note => {
    const matchesTag = tagFilter ? note.tags.includes(tagFilter) : true;
    const matchesSearch =
      note.title.toLowerCase().includes(search.toLowerCase()) ||
      note.content.toLowerCase().includes(search.toLowerCase());
    return matchesTag && matchesSearch;
  });

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ color: '#4a9eff', fontWeight: 700, marginBottom: 18 }}>Notes</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid #4a9eff33',
            fontSize: 15,
            background: '#181c20',
            color: '#e6e6e6',
            width: 240
          }}
        />
        {tagFilter && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)', color: '#fff', borderRadius: 16, padding: '4px 12px', fontWeight: 500, fontSize: 14 }}>{tagFilter}</span>
            <button onClick={() => setTagFilter(null)} style={{ background: 'none', border: 'none', color: '#ff5c5c', fontSize: 18, cursor: 'pointer' }}>×</button>
            <span style={{ color: '#b0b8c1', fontSize: 14 }}>Clear filter</span>
          </div>
        )}
      </div>
      <div
        style={{
          width: '75%',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 18,
          justifyContent: 'center',
        }}
      >
        {filteredNotes.length === 0 ? (
          <div className="no-notes">No notes found.</div>
        ) : (
          filteredNotes.map(note => (
            <div
              key={note.id}
              className="note-card"
              style={{
                background: '#23272f',
                borderRadius: 16,
                width: 240,
                minHeight: 80,
                maxHeight: 180,
                padding: '20px 18px 16px 18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
                border: '2px solid transparent',
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                cursor: 'pointer',
                justifyContent: 'flex-start',
                alignItems: 'flex-start',
                transition: 'box-shadow 0.18s, border 0.18s',
                overflow: 'hidden',
                position: 'relative',
              }}
              onClick={() => setModalNote(note)}
              onMouseOver={e => (e.currentTarget.style.boxShadow = '0 4px 16px #4a9eff33')}
              onMouseOut={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                <h3 style={{ margin: 0, color: '#7f53ff', fontSize: '1.08rem', fontWeight: 700, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>{note.title}</h3>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteNote(note.id); }}
                  style={{ background: 'none', border: 'none', color: '#ff5c5c', fontSize: 18, cursor: 'pointer', marginLeft: 4, marginTop: 2, lineHeight: 1 }}
                  title="Delete note"
                >×</button>
              </div>
              <div style={{ height: 8 }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 0, width: '100%' }}>
                {note.tags.map(tag => (
                  <span
                    key={tag}
                    onClick={e => { e.stopPropagation(); setTagFilter(tag); }}
                    style={{
                      background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                      color: '#fff',
                      borderRadius: 16,
                      padding: '3px 12px',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      marginBottom: 4,
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                      boxShadow: '0 1px 4px #4a9eff22',
                    }}
                  >{tag}</span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {/* Modal for note content */}
      {modalNote && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(24,28,32,0.85)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setModalNote(null)}
        >
          <div
            style={{
              background: '#23272f',
              borderRadius: 18,
              padding: '32px 32px 24px 32px',
              minWidth: 320,
              maxWidth: 420,
              boxShadow: '0 8px 32px #0008',
              position: 'relative',
              color: '#e6e6e6',
              border: '1.5px solid #4a9eff33',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setModalNote(null)}
              style={{
                position: 'absolute',
                top: 16,
                right: 18,
                background: 'none',
                border: 'none',
                color: '#ff5c5c',
                fontSize: 22,
                cursor: 'pointer',
                fontWeight: 700,
                zIndex: 2,
              }}
              title="Close"
            >×</button>
            <h2 style={{ color: '#7f53ff', fontWeight: 700, fontSize: 22, margin: 0 }}>{modalNote.title}</h2>
            <div style={{ color: '#b0b8c1', fontSize: 16, marginBottom: 8, whiteSpace: 'pre-line' }}>{modalNote.content}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {modalNote.tags.map(tag => (
                <span
                  key={tag}
                  onClick={() => { setTagFilter(tag); setModalNote(null); }}
                  style={{
                    background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                    color: '#fff',
                    borderRadius: 16,
                    padding: '4px 14px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    marginBottom: 2,
                    userSelect: 'none',
                    boxShadow: '0 1px 4px #4a9eff22',
                  }}
                >{tag}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesPanel; 
 