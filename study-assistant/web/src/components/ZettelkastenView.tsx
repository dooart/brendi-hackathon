import React, { useEffect, useRef } from 'react';
import ForceGraph2D from 'force-graph';
import { Note } from '../types';

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
  }>;
}

export const ZettelkastenView: React.FC<ZettelkastenViewProps> = ({ notes, onNoteClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create graph data
    const graphData: GraphData = {
      nodes: notes.map(note => ({
        id: note.id,
        name: note.title,
        val: 1,
        color: '#4a9eff'
      })),
      links: []
    };

    // Add links based on shared tags
    notes.forEach(note => {
      note.tags.forEach(tag => {
        notes.forEach(otherNote => {
          if (note.id !== otherNote.id && otherNote.tags.includes(tag)) {
            graphData.links.push({
              source: note.id,
              target: otherNote.id,
              color: '#7f53ff'
            });
          }
        });
      });
    });

    // Initialize the graph
    if (!graphRef.current) {
      const Graph = ForceGraph2D;
      graphRef.current = new Graph(containerRef.current)
        .graphData(graphData)
        .nodeLabel('name')
        .nodeColor('color')
        .linkColor('color')
        .linkWidth(1)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleWidth(2)
        .onNodeClick((node: any) => {
          const note = notes.find(n => n.id === node.id);
          if (note) onNoteClick(note);
        });
    } else {
      graphRef.current.graphData(graphData);
    }

    // Cleanup
    return () => {
      if (graphRef.current) {
        graphRef.current._destructor();
        graphRef.current = null;
      }
    };
  }, [notes, onNoteClick]);

  return (
    <div className="zettelkasten-view">
      <div ref={containerRef} className="graph-container" />
      <div className="legend">
        <h3>Legend</h3>
        <div className="legend-item">
          <div className="dot shared-tags"></div>
          <span>Shared Tags</span>
        </div>
        <div className="legend-item">
          <div className="dot related-notes"></div>
          <span>Related Notes</span>
        </div>
      </div>
    </div>
  );
};

export default ZettelkastenView; 