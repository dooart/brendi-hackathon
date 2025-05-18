import Database from 'better-sqlite3';
import { Document } from 'langchain/document';
import path from 'path';
import { Note } from './notes';

export class NoteDatabase {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(process.cwd(), 'study_notes.db');
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        filename TEXT NOT NULL,
        originalname TEXT NOT NULL,
        embedding TEXT,
        text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        embedding BLOB,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL,
        related_notes TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_modified TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        message_index INTEGER NOT NULL,
        next_review TEXT,
        interval INTEGER,
        easiness REAL,
        repetitions INTEGER,
        last_review TEXT,
        last_performance INTEGER
      )
    `);
  }

  saveDocument(title: string, chunks: Document[]): number {
    const insertDoc = this.db.prepare('INSERT INTO documents (title) VALUES (?)');
    const insertChunk = this.db.prepare(`
      INSERT INTO document_chunks (document_id, content, page_number, embedding)
      VALUES (?, ?, ?, ?)
    `);

    const result = this.db.transaction(() => {
      const docId = insertDoc.run(title).lastInsertRowid as number;
      
      for (const chunk of chunks) {
        const page = chunk.metadata.page as number;
        const embedding = chunk.metadata.embedding as number[];
        insertChunk.run(
          docId,
          chunk.pageContent,
          page,
          embedding ? JSON.stringify(embedding) : null
        );
      }
      
      return docId;
    })();

    return result;
  }

  getDocumentChunks(documentId: number): Document[] {
    interface ChunkRow {
      content: string;
      page_number: number;
      embedding: string | null;
    }

    const chunks = this.db.prepare(`
      SELECT content, page_number, embedding
      FROM document_chunks
      WHERE document_id = ?
      ORDER BY page_number
    `).all(documentId) as ChunkRow[];

    return chunks.map(chunk => ({
      pageContent: chunk.content,
      metadata: {
        page: chunk.page_number,
        embedding: chunk.embedding ? JSON.parse(chunk.embedding) : null
      }
    }));
  }

  getAllDocuments(): { id: number; title: string }[] {
    interface DocumentRow {
      id: number;
      title: string;
    }

    return this.db.prepare('SELECT id, title FROM documents').all() as DocumentRow[];
  }

  deleteDocument(documentId: number): void {
    this.db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
  }

  public close(): void {
    this.db.close();
  }

  public saveNote(note: Note): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO notes (
        id, title, content, tags, related_notes,
        created_at, last_modified, conversation_id, message_index,
        next_review, interval, easiness, repetitions, last_review, last_performance
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      note.id,
      note.title,
      note.content,
      JSON.stringify(note.tags),
      JSON.stringify(note.relatedNotes),
      note.createdAt.toISOString(),
      note.lastModified.toISOString(),
      note.source.conversationId,
      note.source.messageIndex,
      note.nextReview ? note.nextReview.toISOString() : null,
      note.interval ?? null,
      note.easiness ?? null,
      note.repetitions ?? null,
      note.lastReview ? note.lastReview.toISOString() : null,
      note.lastPerformance ?? null
    );
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
      },
      nextReview: note.next_review ? new Date(note.next_review) : undefined,
      interval: note.interval ?? undefined,
      easiness: note.easiness ?? undefined,
      repetitions: note.repetitions ?? undefined,
      lastReview: note.last_review ? new Date(note.last_review) : undefined,
      lastPerformance: note.last_performance ?? undefined
    };
  }

  public getNotesByTag(tag: string): Note[] {
    const notes = this.db.prepare(`
      SELECT * FROM notes WHERE tags LIKE ?
    `).all(`%${tag}%`) as NoteRow[];

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
      },
      nextReview: note.next_review ? new Date(note.next_review) : undefined,
      interval: note.interval ?? undefined,
      easiness: note.easiness ?? undefined,
      repetitions: note.repetitions ?? undefined,
      lastReview: note.last_review ? new Date(note.last_review) : undefined,
      lastPerformance: note.last_performance ?? undefined
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
      },
      nextReview: note.next_review ? new Date(note.next_review) : undefined,
      interval: note.interval ?? undefined,
      easiness: note.easiness ?? undefined,
      repetitions: note.repetitions ?? undefined,
      lastReview: note.last_review ? new Date(note.last_review) : undefined,
      lastPerformance: note.last_performance ?? undefined
    }));
  }

  public deleteNote(id: string): void {
    this.db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  }

  saveUploadedDocument({ title, filename, originalname, embedding, text }: { title: string, filename: string, originalname: string, embedding: number[], text: string }): number {
    const stmt = this.db.prepare(`
      INSERT INTO documents (title, filename, originalname, embedding, text)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, filename, originalname, JSON.stringify(embedding), text);
    return result.lastInsertRowid as number;
  }

  getAllUploadedDocuments(): { id: number; title: string; filename: string; originalname: string; created_at: string }[] {
    return this.db.prepare('SELECT id, title, filename, originalname, created_at FROM documents ORDER BY created_at DESC').all() as { id: number; title: string; filename: string; originalname: string; created_at: string }[];
  }

  deleteUploadedDocument(id: number): void {
    this.db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  }
}

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
  next_review?: string;
  interval?: number;
  easiness?: number;
  repetitions?: number;
  last_review?: string;
  last_performance?: number;
}; 