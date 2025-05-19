import React, { useState, useEffect } from 'react';
import { Note } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface NotesPanelProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
  onDeleteNote: (noteId: string) => Promise<void>;
}

const NotesPanel: React.FC<NotesPanelProps> = ({ notes, onNoteClick, onDeleteNote }) => {
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [modalNote, setModalNote] = useState<Note | null>(null);
  const [showTags, setShowTags] = useState(false);

  // Update modal note when notes array changes
  useEffect(() => {
    if (modalNote) {
      const updatedNote = notes.find(n => n.id === modalNote.id);
      if (updatedNote) {
        setModalNote(updatedNote);
      }
    }
  }, [notes]);

  // Gather all unique tags for quick filter
  const allTags = Array.from(new Set(notes.flatMap(n => n.tags)));

  // Filter notes by search and tag
  const filteredNotes = notes.filter(note => {
    const matchesTag = tagFilter ? note.tags.includes(tagFilter) : true;
    const matchesSearch =
      note.title.toLowerCase().includes(search.toLowerCase()) ||
      note.content.toLowerCase().includes(search.toLowerCase());
    return matchesTag && matchesSearch;
  });

  return (
    <div style={{ padding: '40px 0', minHeight: '100vh', background: 'linear-gradient(120deg, #23272f 0%, #181c20 100%)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h1 style={{ color: '#4a9eff', fontWeight: 800, fontSize: 36, marginBottom: 2, letterSpacing: -1 }}>📝 My Notes</h1>
            <div style={{ color: '#b0b8c1', fontSize: 18, fontWeight: 500 }}>Your knowledge, organized and ready for review.</div>
          </div>
          {/* Placeholder for New Note button or future actions */}
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              border: '1.5px solid #4a9eff33',
              fontSize: 17,
              background: '#181c20',
              color: '#e6e6e6',
              width: 280,
              boxShadow: '0 2px 8px #4a9eff11',
              outline: 'none',
              fontWeight: 500
            }}
          />
          <button
            onClick={() => setShowTags(t => !t)}
            style={{
              background: showTags ? 'linear-gradient(90deg, #7f53ff 0%, #4a9eff 100%)' : 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 16,
              padding: '8px 18px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: showTags ? '0 2px 8px #7f53ff33' : '0 1px 4px #4a9eff22',
              transition: 'all 0.18s',
            }}
          >
            {showTags ? 'Hide Tags' : 'Show Tags'}
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {showTags && (
              <>
                {allTags.map(tag => (
                  <span
                    key={tag}
                    onClick={() => setTagFilter(tag)}
                    style={{
                      background: tagFilter === tag ? 'linear-gradient(90deg, #7f53ff 0%, #4a9eff 100%)' : 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                      color: '#fff',
                      borderRadius: 16,
                      padding: '6px 16px',
                      fontSize: 15,
                      fontWeight: 600,
                      cursor: 'pointer',
                      marginBottom: 2,
                      userSelect: 'none',
                      boxShadow: tagFilter === tag ? '0 2px 8px #7f53ff33' : '0 1px 4px #4a9eff22',
                      border: tagFilter === tag ? '2px solid #fff2' : '2px solid transparent',
                      transition: 'all 0.18s',
                    }}
                  >{tag}</span>
                ))}
                {tagFilter && (
                  <button onClick={() => setTagFilter(null)} style={{ background: 'none', border: 'none', color: '#ff5c5c', fontSize: 18, cursor: 'pointer', marginLeft: 4, fontWeight: 700 }}>×</button>
                )}
              </>
            )}
          </div>
        </div>
        <div
          style={{
            width: '100%',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
            gap: 28,
            justifyContent: 'center',
            alignItems: 'stretch',
            minHeight: 320
          }}
        >
          {filteredNotes.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#b0b8c1', fontSize: 22, padding: '60px 0' }}>
              <div style={{ fontSize: 60, marginBottom: 12 }}>🗒️</div>
              <div>No notes found.<br />Try a different search or tag.</div>
            </div>
          ) : (
            filteredNotes.map((note, idx) => (
              <div
                key={note.id || idx}
                className="note-card"
                style={{
                  background: 'linear-gradient(120deg, #23272f 0%, #23273a 100%)',
                  borderRadius: 18,
                  minHeight: 120,
                  maxHeight: 220,
                  padding: '26px 22px 18px 22px',
                  boxShadow: '0 4px 18px #4a9eff11',
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
                onMouseOver={e => (e.currentTarget.style.boxShadow = '0 8px 32px #4a9eff33')}
                onMouseOut={e => (e.currentTarget.style.boxShadow = '0 4px 18px #4a9eff11')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
                  <h3 style={{ margin: 0, color: '#7f53ff', fontSize: '1.13rem', fontWeight: 800, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>{note.title}</h3>
                  <button
                    onClick={e => { e.stopPropagation(); onDeleteNote(note.id); }}
                    style={{ background: 'none', border: 'none', color: '#ff5c5c', fontSize: 20, cursor: 'pointer', marginLeft: 4, marginTop: 2, lineHeight: 1, fontWeight: 700 }}
                    title="Delete note"
                  >×</button>
                </div>
                <div style={{ height: 10 }} />
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 0, width: '100%' }}>
                  {note.tags.map(tag => (
                    <span
                      key={tag}
                      onClick={e => { e.stopPropagation(); setTagFilter(tag); }}
                      style={{
                        background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                        color: '#fff',
                        borderRadius: 16,
                        padding: '4px 13px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                        boxShadow: '0 1px 4px #4a9eff22',
                      }}
                    >{tag}</span>
                  ))}
                </div>
                <div style={{ height: 10 }} />
                <div style={{ color: '#b0b8c1', fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'pre-line', maxHeight: 60 }}>
                  <MarkdownRenderer content={note.content.length > 120 ? note.content.slice(0, 120) + '…' : note.content} />
                </div>
              </div>
            ))
          )}
        </div>
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
              borderRadius: 22,
              padding: '40px 40px 28px 40px',
              minWidth: 340,
              maxWidth: 520,
              boxShadow: '0 12px 48px #0008',
              position: 'relative',
              color: '#e6e6e6',
              border: '2px solid #4a9eff33',
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setModalNote(null)}
              style={{
                position: 'absolute',
                top: 18,
                right: 22,
                background: 'none',
                border: 'none',
                color: '#ff5c5c',
                fontSize: 26,
                cursor: 'pointer',
                fontWeight: 800,
                zIndex: 2,
              }}
              title="Close"
            >×</button>
            <h2 style={{ color: '#7f53ff', fontWeight: 800, fontSize: 26, margin: 0 }}>{modalNote.title}</h2>
            <div style={{ color: '#b0b8c1', fontSize: 17, marginBottom: 8, fontWeight: 500 }}>
              <MarkdownRenderer content={modalNote.content} />
            </div>
            {/* SRS Information */}
            <div style={{ 
              background: 'linear-gradient(90deg, #23273a 0%, #23272f 100%)',
              borderRadius: 16,
              padding: '18px 20px',
              marginBottom: 8,
              border: '1.5px solid #4a9eff33'
            }}>
              <div style={{ color: '#7f53ff', fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Review Status</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 20px' }}>
                <div>
                  <div style={{ color: '#b0b8c1', fontSize: 14, marginBottom: 4 }}>Next Review</div>
                  <div style={{ color: '#e6e6e6', fontWeight: 600 }}>
                    {modalNote.nextReview ? new Date(modalNote.nextReview).toLocaleDateString() : 'Not scheduled'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#b0b8c1', fontSize: 14, marginBottom: 4 }}>Interval</div>
                  <div style={{ color: '#e6e6e6', fontWeight: 600 }}>
                    {modalNote.interval ? `${modalNote.interval} days` : 'Not set'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#b0b8c1', fontSize: 14, marginBottom: 4 }}>Easiness</div>
                  <div style={{ color: '#e6e6e6', fontWeight: 600 }}>
                    {modalNote.easiness ? modalNote.easiness.toFixed(2) : 'Not set'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#b0b8c1', fontSize: 14, marginBottom: 4 }}>Last Performance</div>
                  <div style={{ color: '#e6e6e6', fontWeight: 600 }}>
                    {modalNote.lastPerformance ? `${modalNote.lastPerformance}/5` : 'Not reviewed'}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {modalNote.tags.map(tag => (
                <span
                  key={tag}
                  onClick={() => { setTagFilter(tag); setModalNote(null); }}
                  style={{
                    background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                    color: '#fff',
                    borderRadius: 16,
                    padding: '5px 16px',
                    fontSize: 15,
                    fontWeight: 600,
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
 