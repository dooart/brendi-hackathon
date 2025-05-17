import Database from 'better-sqlite3';
import { Note } from './notes';
import path from 'path';

// Database result types
type NoteRow = {
  id: string;
  title: string;
  content: string;
  tags: string;
  related_notes: string;
  created_at: string;
  last_modified: string;
  conversation_id: string;
  message_index: number;
};

type TagRow = {
  id: number;
  name: string;
};

export class NoteDatabase {
  private db: Database.Database;

  constructor() {
    // Create database in the project root
    const dbPath = path.join(process.cwd(), 'study_notes.db');
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    // Create notes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL,
        related_notes TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_modified TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        message_index INTEGER NOT NULL
      )
    `);

    // Create tags table for better tag management
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    // Create note_tags junction table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS note_tags (
        note_id TEXT NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (note_id, tag_id),
        FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);
  }

  public saveNote(note: Note): void {
    const insertNote = this.db.prepare(`
      INSERT INTO notes (
        id, title, content, tags, related_notes,
        created_at, last_modified, conversation_id, message_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTag = this.db.prepare(`
      INSERT OR IGNORE INTO tags (name) VALUES (?)
    `);

    const getTagId = this.db.prepare(`
      SELECT id FROM tags WHERE name = ?
    `);

    const insertNoteTag = this.db.prepare(`
      INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)
    `);

    // Start a transaction
    this.db.transaction(() => {
      // Insert the note
      insertNote.run(
        note.id,
        note.title,
        note.content,
        JSON.stringify(note.tags),
        JSON.stringify(note.relatedNotes),
        note.createdAt.toISOString(),
        note.lastModified.toISOString(),
        note.source.conversationId,
        note.source.messageIndex
      );

      // Insert tags and create relationships
      note.tags.forEach(tag => {
        insertTag.run(tag);
        const tagResult = getTagId.get(tag) as TagRow | undefined;
        if (tagResult?.id) {
          insertNoteTag.run(note.id, tagResult.id);
        }
      });
    })();
  }

  public getNote(id: string): Note | null {
    const note = this.db.prepare(`
      SELECT * FROM notes WHERE id = ?
    `).get(id) as NoteRow | undefined;

    if (!note) return null;

    return {
      id: note.id,
      title: note.title,
      content: note.content,
      tags: JSON.parse(note.tags),
      relatedNotes: JSON.parse(note.related_notes),
      createdAt: new Date(note.created_at),
      lastModified: new Date(note.last_modified),
      source: {
        conversationId: note.conversation_id,
        messageIndex: note.message_index
      }
    };
  }

  public getNotesByTag(tag: string): Note[] {
    const notes = this.db.prepare(`
      SELECT n.* FROM notes n
      JOIN note_tags nt ON n.id = nt.note_id
      JOIN tags t ON nt.tag_id = t.id
      WHERE t.name = ?
    `).all(tag) as NoteRow[];

    return notes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: JSON.parse(note.tags),
      relatedNotes: JSON.parse(note.related_notes),
      createdAt: new Date(note.created_at),
      lastModified: new Date(note.last_modified),
      source: {
        conversationId: note.conversation_id,
        messageIndex: note.message_index
      }
    }));
  }

  public getAllNotes(): Note[] {
    const notes = this.db.prepare('SELECT * FROM notes').all() as NoteRow[];
    return notes.map(note => ({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: JSON.parse(note.tags),
      relatedNotes: JSON.parse(note.related_notes),
      createdAt: new Date(note.created_at),
      lastModified: new Date(note.last_modified),
      source: {
        conversationId: note.conversation_id,
        messageIndex: note.message_index
      }
    }));
  }

  public updateNote(note: Note): void {
    this.db.prepare(`
      UPDATE notes
      SET title = ?,
          content = ?,
          tags = ?,
          related_notes = ?,
          last_modified = ?
      WHERE id = ?
    `).run(
      note.title,
      note.content,
      JSON.stringify(note.tags),
      JSON.stringify(note.relatedNotes),
      note.lastModified.toISOString(),
      note.id
    );
  }

  public deleteNote(id: string): void {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  public close(): void {
    this.db.close();
  }
} 