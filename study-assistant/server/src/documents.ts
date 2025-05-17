import { OpenAI } from 'openai';
import { Document } from 'langchain/document';
import { NoteDatabase } from './database';

export class DocumentManager {
  private noteDb: NoteDatabase;

  constructor() {
    this.noteDb = new NoteDatabase();
  }

  async loadPDF(filePath: string): Promise<void> {
    // TODO: Implement PDF loading and processing
    console.log('PDF loading not implemented yet');
  }

  getLoadedDocuments(): { id: number; title: string }[] {
    return this.noteDb.getAllDocuments();
  }

  async removeDocument(fileName: string): Promise<void> {
    // TODO: Implement document removal
    console.log('Document removal not implemented yet');
  }
} 