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
}

export default DocumentDatabase; 