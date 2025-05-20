import Database from 'better-sqlite3';
import path from 'path';

export class DocumentDatabase {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(process.cwd(), 'documents.db');
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        originalname TEXT NOT NULL,
        embedding TEXT,
        text TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS document_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        embedding TEXT,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
    `);
  }

  saveDocument({ title, originalname, embedding, text }: { title: string, originalname: string, embedding: number[], text: string }): number {
    const stmt = this.db.prepare(`
      INSERT INTO documents (title, originalname, embedding, text)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(title, originalname, JSON.stringify(embedding), text);
    return result.lastInsertRowid as number;
  }

  saveChunks(documentId: number, chunks: { chunk_index: number, chunk_text: string, embedding: number[] }[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO document_chunks (document_id, chunk_index, chunk_text, embedding)
      VALUES (?, ?, ?, ?)
    `);
    const insertMany = this.db.transaction((chunksArr) => {
      for (const chunk of chunksArr) {
        stmt.run(documentId, chunk.chunk_index, chunk.chunk_text, JSON.stringify(chunk.embedding));
      }
    });
    insertMany(chunks);
  }

  getAllDocuments(): { id: number; title: string; originalname: string; created_at: string }[] {
    return this.db.prepare('SELECT id, title, originalname, created_at FROM documents ORDER BY created_at DESC').all() as { id: number; title: string; originalname: string; created_at: string }[];
  }

  deleteDocument(id: number): void {
    this.db.prepare('DELETE FROM documents WHERE id = ?').run(id);
  }

  public getEmbeddingAndText(id: number): { embedding: number[]; text: string } | null {
    const row = this.db.prepare('SELECT embedding, text FROM documents WHERE id = ?').get(id) as { embedding: string; text: string } | undefined;
    if (!row) return null;
    return { embedding: JSON.parse(row.embedding), text: row.text };
  }

  getAllChunks(): { id: number; document_id: number; chunk_index: number; chunk_text: string; embedding: number[] }[] {
    const rows = this.db.prepare(`
      SELECT id, document_id, chunk_index, chunk_text, embedding 
      FROM document_chunks 
      ORDER BY document_id, chunk_index ASC
    `).all();
    return rows.map((row: any) => ({ ...row, embedding: JSON.parse(row.embedding) }));
  }

  getChunkWithDocMeta(chunkId: number): { title: string; originalname: string } | null {
    const row = this.db.prepare(`
      SELECT d.title, d.originalname
      FROM documents d
      JOIN document_chunks c ON c.document_id = d.id
      WHERE c.id = ?
    `).get(chunkId) as { title: string; originalname: string } | undefined;
    return row || null;
  }

  saveDocumentWithChunks({ title, originalname, embedding, text, chunks }: { title: string, originalname: string, embedding: number[], text: string, chunks: { chunk_index: number, chunk_text: string, embedding: number[] }[] }): number {
    const insertDoc = this.db.prepare(`
      INSERT INTO documents (title, originalname, embedding, text)
      VALUES (?, ?, ?, ?)
    `);
    const insertChunk = this.db.prepare(`
      INSERT INTO document_chunks (document_id, chunk_index, chunk_text, embedding)
      VALUES (?, ?, ?, ?)
    `);
    const result = this.db.transaction(() => {
      const docId = insertDoc.run(title, originalname, JSON.stringify(embedding), text).lastInsertRowid as number;
      for (const chunk of chunks) {
        insertChunk.run(docId, chunk.chunk_index, chunk.chunk_text, JSON.stringify(chunk.embedding));
      }
      return docId;
    })();
    return result;
  }

  updateDocumentEmbeddingAndText(id: number, embedding: number[], text: string): void {
    this.db.prepare('UPDATE documents SET embedding = ?, text = ? WHERE id = ?').run(JSON.stringify(embedding), text, id);
  }
}

export default DocumentDatabase; 