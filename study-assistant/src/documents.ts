import pdfParse from 'pdf-parse';
import { Document } from 'langchain/document';
import { OpenAIEmbeddings } from '@langchain/openai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import fs from 'fs/promises';
import path from 'path';
import { NoteDatabase } from './database';

const logProgress = (stage: string, details?: string) => {
  console.log(`\n📚 ${stage}${details ? `: ${details}` : ''}`);
};

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
    try {
      logProgress('Starting PDF processing');
      
      // Read the PDF file
      logProgress('Reading PDF file');
      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdfParse(dataBuffer);
      
      // Extract text from all pages
      logProgress('Extracting text', `Found ${pdfData.numpages} pages`);
      const text = pdfData.text;
      
      // Split text into chunks
      logProgress('Splitting text into chunks');
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      
      const chunks = await splitter.createDocuments([text]);
      logProgress('Text processing', `Created ${chunks.length} chunks`);
      
      // Add metadata to chunks
      const fileName = path.basename(filePath);
      const documents = chunks.map(chunk => ({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          source: fileName,
          page: chunk.metadata.loc?.lines?.from || 0,
        },
      }));

      // Generate embeddings for each chunk
      logProgress('Generating embeddings');
      const documentsWithEmbeddings = await Promise.all(
        documents.map(async (doc, index) => {
          const embedding = await this.embeddings.embedQuery(doc.pageContent);
          if ((index + 1) % 10 === 0) {
            logProgress('Embedding progress', `${index + 1}/${documents.length} chunks processed`);
          }
          return {
            ...doc,
            metadata: {
              ...doc.metadata,
              embedding,
            },
          };
        })
      );

      // Save to database
      logProgress('Saving to database');
      this.db.saveDocument(fileName, documentsWithEmbeddings);
      
      // Add to vector store
      logProgress('Adding to vector store');
      await this.vectorStore.addDocuments(documentsWithEmbeddings);
      
      logProgress('Processing complete', `Successfully loaded ${fileName} with ${documents.length} chunks`);
    } catch (error) {
      console.error('\n❌ Error loading PDF:', error);
      throw error;
    }
  }

  async searchDocuments(query: string, k: number = 3): Promise<Document[]> {
    try {
      const results = await this.vectorStore.similaritySearch(query, k);
      return results;
    } catch (error) {
      console.error('Error searching documents:', error);
      throw error;
    }
  }

  getLoadedDocuments(): string[] {
    return this.db.getAllDocuments().map(doc => doc.title);
  }

  async removeDocument(fileName: string): Promise<void> {
    const documents = this.db.getAllDocuments();
    const doc = documents.find(d => d.title === fileName);
    if (doc) {
      // Remove from vector store
      await this.vectorStore.delete({ filter: { source: fileName } });
      // Remove from database
      this.db.deleteDocument(doc.id);
      console.log(`Removed ${fileName} from the knowledge base`);
    }
  }
} 