import Database from 'better-sqlite3';
import { Document } from 'langchain/document';
import path from 'path';

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
} 