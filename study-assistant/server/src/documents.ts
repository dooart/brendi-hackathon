import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import fs from 'fs/promises';
import path from 'path';
import { NoteDatabase } from './database.js';

interface DocumentInfo {
  id: number;
  title: string;
}

export class DocumentManager {
  private vectorStore: MemoryVectorStore;
  private embeddings: OpenAIEmbeddings;
  private db: NoteDatabase;

  constructor(apiKey: string, db: NoteDatabase) {
    this.embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey });
    this.vectorStore = new MemoryVectorStore(this.embeddings);
    this.db = db;
  }

  async loadPDF(filePath: string): Promise<void> {
    const fileContent = await fs.readFile(filePath);
    const fileName = path.basename(filePath);

    // Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const chunks = await splitter.createDocuments([fileContent.toString()]);

    // Save to database
    this.db.saveDocument(fileName, chunks);

    // Add to vector store
    await this.vectorStore.addDocuments(chunks);
  }

  getLoadedDocuments(): string[] {
    return this.db.getAllDocuments().map((doc: DocumentInfo) => doc.title);
  }

  async removeDocument(fileName: string): Promise<void> {
    const documents = this.db.getAllDocuments();
    const doc = documents.find((d: DocumentInfo) => d.title === fileName);
    if (doc) {
      this.db.deleteDocument(doc.id);
    }
  }
} 