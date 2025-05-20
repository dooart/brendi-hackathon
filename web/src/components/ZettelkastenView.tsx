import React, { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'force-graph';
import { Note } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ZettelkastenViewProps {
  notes: Note[];
  onNoteClick: (note: Note) => void;
}

interface GraphData {
  nodes: Array<{
    id: string;
    name: string;
    val: number;
    color: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    color: string;
    sharedTags: string[];
    width: number;
  }>;
}

export const ZettelkastenView: React.FC<ZettelkastenViewProps> = ({ notes, onNoteClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [modalNote, setModalNote] = useState<Note | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  // Update modal note when notes array changes
  useEffect(() => {
    if (modalNote) {
      const updatedNote = notes.find(n => n.id === modalNote.id);
      if (updatedNote) {
        setModalNote(updatedNote);
      }
    }
  }, [notes]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Build a map to avoid duplicate links and store shared tags
    const linkMap: Record<string, { source: string; target: string; sharedTags: string[] }> = {};
    notes.forEach(note => {
      notes.forEach(otherNote => {
        if (note.id !== otherNote.id) {
          const sharedTags = note.tags.filter(tag => otherNote.tags.includes(tag));
          if (sharedTags.length > 0) {
            // Use sorted ids to avoid duplicate links
            const key = [note.id, otherNote.id].sort().join('-');
            if (!linkMap[key]) {
              linkMap[key] = {
                source: note.id,
                target: otherNote.id,
                sharedTags
              };
            }
          }
        }
      });
    });

    const graphData: GraphData = {
      nodes: notes.map(note => ({
        id: note.id,
        name: note.title,
        val: 1,
        color: '#4a9eff'
      })),
      links: Object.values(linkMap).map(link => ({
        source: link.source,
        target: link.target,
        color: '#7f53ff',
        sharedTags: link.sharedTags,
        width: Math.max(1, link.sharedTags.length * 2) // thickness: 2px per tag, min 1
      }))
    };

    // Initialize the graph
    if (!graphRef.current) {
      const Graph = ForceGraph2D;
      graphRef.current = new Graph(containerRef.current)
        .graphData(graphData)
        .nodeLabel('name')
        .nodeColor('color')
        .linkColor('color')
        .linkWidth((link: any) => link.width)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleWidth(2)
        .onNodeClick((node: any) => {
          const note = notes.find(n => n.id === node.id);
          if (note) setModalNote(note);
        })
        .onLinkHover((link: any, prevLink: any) => {
          if (link) {
            // Get mouse position relative to container
            const rect = containerRef.current!.getBoundingClientRect();
            // Use last mousemove event
            const mousemove = (window as any)._zettelMouseMove;
            if (mousemove) {
              setTooltip({
                x: mousemove.clientX - rect.left,
                y: mousemove.clientY - rect.top,
                content: `${link.sharedTags.length} shared tag${link.sharedTags.length > 1 ? 's' : ''}: ${link.sharedTags.join(', ')}`
              });
            } else {
              setTooltip({ x: 100, y: 100, content: `${link.sharedTags.length} shared tag${link.sharedTags.length > 1 ? 's' : ''}: ${link.sharedTags.join(', ')}` });
            }
          } else {
            setTooltip(null);
          }
        });
    } else {
      graphRef.current.graphData(graphData);
      graphRef.current.linkWidth((link: any) => link.width);
    }

    // Listen for mousemove to track position for tooltip
    const mouseMoveHandler = (e: MouseEvent) => {
      (window as any)._zettelMouseMove = e;
    };
    window.addEventListener('mousemove', mouseMoveHandler);

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', mouseMoveHandler);
      if (graphRef.current) {
        graphRef.current._destructor();
        graphRef.current = null;
      }
    };
  }, [notes, onNoteClick]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(120deg, #23272f 0%, #181c20 100%)', padding: '40px 0', position: 'relative' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{ color: '#7f53ff', fontWeight: 800, fontSize: 38, marginBottom: 4, letterSpacing: -1 }}>Zettelkasten Knowledge Graph</h1>
          <div style={{ color: '#b0b8c1', fontSize: 19, fontWeight: 500, marginBottom: 0 }}>Visualize your notes and their connections.</div>
        </div>
        <div style={{
          background: 'rgba(35,39,47,0.98)',
          borderRadius: 24,
          boxShadow: '0 8px 32px #4a9eff22',
          padding: '32px 0',
          position: 'relative',
          minHeight: 520,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div ref={containerRef} className="graph-container" style={{ width: '100%', minHeight: 420, height: 520, borderRadius: 18, overflow: 'hidden', background: 'linear-gradient(120deg, #23272f 0%, #23273a 100%)', border: '2px solid #4a9eff22', boxShadow: '0 2px 12px #4a9eff11', position: 'relative' }} />
          {tooltip && (
            <div style={{
              position: 'absolute',
              left: tooltip.x + 12,
              top: tooltip.y + 12,
              background: 'rgba(36,40,48,0.95)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: 8,
              boxShadow: '0 2px 8px #7f53ff44',
              pointerEvents: 'none',
              zIndex: 20,
              fontSize: 15,
              fontWeight: 500,
              border: '1.5px solid #7f53ff88',
              maxWidth: 320,
              whiteSpace: 'pre-line',
            }}>
              {tooltip.content}
            </div>
          )}
          <div style={{
            position: 'absolute',
            top: 32,
            right: 32,
            background: 'rgba(36,40,48,0.82)',
            borderRadius: 16,
            boxShadow: '0 2px 12px #7f53ff22',
            padding: '18px 26px',
            zIndex: 10,
            border: '1.5px solid #4a9eff33',
            backdropFilter: 'blur(6px)',
            minWidth: 160,
            color: '#e6e6e6',
          }}>
            <div style={{ fontWeight: 700, color: '#7f53ff', fontSize: 18, marginBottom: 10, letterSpacing: -0.5 }}>Legend</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#7f53ff', boxShadow: '0 0 6px #7f53ff88' }}></div>
              <span style={{ color: '#b0b8c1', fontWeight: 500 }}>Shared Tags</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#4a9eff', boxShadow: '0 0 6px #4a9eff88' }}></div>
              <span style={{ color: '#b0b8c1', fontWeight: 500 }}>Related Notes</span>
            </div>
          </div>
        </div>
      </div>
      {/* Modal for note details */}
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
                  style={{
                    background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                    color: '#fff',
                    borderRadius: 16,
                    padding: '5px 16px',
                    fontSize: 15,
                    fontWeight: 600,
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

export default ZettelkastenView; 