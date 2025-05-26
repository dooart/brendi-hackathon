import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { DocumentManager } from './documents.js';
import { startNoteDetection, Note } from './notes.js';
import { NoteDatabase } from './database.js';
import fetch from 'node-fetch';
import multer, { Multer } from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import DocumentDatabase from './documentDatabase.js';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { generateGeminiResponse, generateNoteWithGemini, geminiModel } from './gemini.js';
import { generateOpenAIResponse } from './openai.js';
import { shouldCreateNote, isSimilarNote } from './notes.js';
import { generateLocalResponse } from './local.js';
import { generateDeepseekResponse, generateNoteWithDeepseek, shouldCreateNoteWithDeepseek } from './deepseek.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'http://localhost:5173',
    'http://127.0.0.1:5173'
  ],
  methods: ['GET', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Explicitly handle OPTIONS for upload endpoint
app.options('/api/documents/upload', cors());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const docManager = new DocumentManager();
const noteDb = new NoteDatabase();
const documentDb = new DocumentDatabase();
let lastCreatedNote: Note | null = null;

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

// Initialize note detection system with Gemini
const noteDetection = startNoteDetection(geminiModel, (note: Note) => {
  lastCreatedNote = note;
  noteDb.saveNote(note);
  console.log('Note created:', note.title);
});

// In-memory upload status map for progress feedback
type UploadStatus = {
  status: string;
  progress: number;
  error?: string;
  chunk?: number;
  totalChunks?: number;
  subChunk?: number;
  totalSubChunks?: number;
  splitChunks?: number;
};
const uploadStatus: Record<string, UploadStatus> = {};

// Helper to generate a unique upload ID
function generateUploadId() {
  return Math.random().toString(36).substring(2, 10) + Date.now();
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function chunkText(text: string, chunkSize = 1500): string[] {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = i + chunkSize;
    // Try to break at a paragraph or sentence boundary
    let nextBreak = text.lastIndexOf('\n', end);
    if (nextBreak <= i) nextBreak = text.indexOf('\n', end);
    if (nextBreak > i && nextBreak - i < chunkSize * 1.5) end = nextBreak;
    chunks.push(text.slice(i, end).trim());
    i = end - 200; // Add 200 character overlap between chunks
  }
  return chunks.filter(Boolean);
}

// Helper to batch an array into arrays of max batchSize
function batchArray<T>(arr: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < arr.length; i += batchSize) {
    batches.push(arr.slice(i, i + batchSize));
  }
  return batches;
}

// --- RAG Usage Logging ---
type RAGChunk = { chunk_index: number; chunk_text: string };
type RAGUsageEntry = {
  documentId: number;
  chunkIndexes: RAGChunk[];
  response: string;
  timestamp: number;
};
const ragUsageLogPath = path.join(process.cwd(), 'rag_usage_log.json');
function logRagUsage(documentId: number, chunkIndexes: RAGChunk[], response: string, timestamp: number) {
  let log: RAGUsageEntry[] = [];
  if (fs.existsSync(ragUsageLogPath)) {
    try {
      log = JSON.parse(fs.readFileSync(ragUsageLogPath, 'utf-8'));
    } catch (err) {
    }
  }
  
  const newEntry = { documentId, chunkIndexes, response, timestamp };
  log.push(newEntry);
  
  try {
    fs.writeFileSync(ragUsageLogPath, JSON.stringify(log, null, 2));
  } catch (err) {
  }
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

interface OllamaChatResponse {
  message?: {
    content: string;
  };
  content?: string;
}

// Helper to get embedding from Ollama
async function getOllamaEmbedding(text: string): Promise<number[]> {
  const res = await fetch('http://localhost:11434/api/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'zylonai/multilingual-e5-large', prompt: text })
  });
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Ollama embedding error:', errorText);
    throw new Error('Ollama embedding failed: ' + errorText);
  }
  const data = await res.json() as OllamaEmbeddingResponse;
  if (!data.embedding) throw new Error('No embedding in Ollama response');
  return data.embedding;
}
// Helper to get embedding from OpenAI
async function getOpenAIEmbedding(text: string): Promise<number[]> {
  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000)
  });
  return embeddingRes.data[0].embedding;
}
// Helper to get embedding based on provider
async function getEmbedding(text: string, provider: 'openai' | 'ollama' = 'openai'): Promise<number[]> {
  if (provider === 'ollama') return getOllamaEmbedding(text);
  return getOpenAIEmbedding(text);
}

// Helper: average multiple embeddings
function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) throw new Error('No embeddings to average');
  const length = embeddings[0].length;
  const sum = new Array(length).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < length; i++) {
      sum[i] += emb[i];
    }
  }
  return sum.map(x => x / embeddings.length);
}

// Chat endpoint: only returns the AI response
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, model = 'gemini', useRag = false, maxChunks = 5 } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let response: string;
    let topChunks: any[] = [];
    let context = '';
    if (model === 'gemini' || model === 'deepseek') {
      if (useRag) {
        // Compute embedding for the user message using Ollama to match stored embeddings
        const queryEmbedding = await getOllamaEmbedding(message);
        // Retrieve all document chunks
        const allChunks = documentDb.getAllChunks();
        // Compute similarity for each chunk
        const scoredChunks = allChunks.map(chunk => ({
          ...chunk,
          similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));
        // Filter by threshold
        const SIMILARITY_THRESHOLD = 0.7;
        let filteredChunks = scoredChunks.filter(chunk => chunk.similarity >= SIMILARITY_THRESHOLD);
        // If none meet the threshold, fall back to top 3
        if (filteredChunks.length === 0) {
          filteredChunks = scoredChunks.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
        } else {
          // Otherwise, sort by similarity descending and take top 5
          filteredChunks = filteredChunks.sort((a, b) => b.similarity - a.similarity).slice(0, maxChunks);
        }
        topChunks = filteredChunks;
        // Log similarity scores for retrieved chunks
        console.log('\nRetrieved chunks similarity scores:');
        topChunks.forEach((chunk, index) => {
          console.log(`Chunk ${index + 1} (doc_id: ${chunk.document_id}, chunk_index: ${chunk.chunk_index}): ${(chunk.similarity * 100).toFixed(2)}%`);
        });
        console.log('---\n');
        context = topChunks.map(chunk => chunk.chunk_text).join('\n\n');
      }
      // Add explicit source references to the prompt when using RAG
      const promptWithSources = useRag ? 
        `Based on the following sources, please provide a response. For each piece of information you use, cite the source number (e.g., [Source 1], [Source 2], etc.).\n\nFormat all math using LaTeX (use $...$ for inline math and $$...$$ for block math), and use Markdown for all formatting (italics, bold, lists, etc.). Separate paragraphs with double newlines.\n\nSources:\n${topChunks.map((chunk, i) => `[Source ${i + 1}] ${chunk.chunk_text}`).join('\n\n')}\n\nUser question: ${message}\n\nPlease provide a comprehensive response that directly references the sources above.` :
        message;

      if (model === 'gemini') {
        response = await generateGeminiResponse(promptWithSources, history, context || undefined);
      } else {
        response = await generateDeepseekResponse(promptWithSources, history, context || undefined);
      }
      // Log RAG usage
      if (useRag && topChunks.length > 0) {
        const docId = topChunks[0].document_id;
        logRagUsage(
          docId,
          topChunks.map(chunk => ({ chunk_index: chunk.chunk_index, chunk_text: chunk.chunk_text })),
          response,
          Date.now()
        );
      }
    } else if (model === 'openai') {
      response = await generateOpenAIResponse(message, history);
    } else if (model === 'local') {
      response = await generateLocalResponse(message, history);
    } else {
      return res.status(400).json({ error: 'Invalid model specified' });
    }

    res.json({ 
      response,
      retrievedChunks: useRag ? topChunks.map(chunk => ({
        documentId: chunk.document_id,
        chunkIndex: chunk.chunk_index,
        text: chunk.chunk_text,
        similarity: chunk.similarity
      })) : undefined
    });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Note endpoint: returns a note for a given assistant response
app.post('/api/note', async (req: Request, res: Response) => {
  try {
    const { content, model = 'gemini' } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Use the same model for both note detection and generation
    const shouldCreate = model === 'deepseek' ? 
      await shouldCreateNoteWithDeepseek({ role: 'assistant', content }) :
      await shouldCreateNote(geminiModel, { role: 'assistant', content });

    let notes: Note[] = [];
    if (shouldCreate) {
      const generatedNotes = model === 'gemini' ?
        await generateNoteWithGemini(
          { role: 'assistant', content },
          'chat-' + Date.now(),
          0
        ) :
        await generateNoteWithDeepseek(
          { role: 'assistant', content },
          'chat-' + Date.now(),
          0
        );
      // Save each unique note
      const allNotes = noteDb.getAllNotes();
      notes = generatedNotes.filter(note => {
        if (!isSimilarNote(note, allNotes)) {
          noteDb.saveNote(note);
          allNotes.push(note); // Avoid near-duplicates in this batch
          console.log('Note saved to database:', note.title);
          return true;
        } else {
          console.log('Skipped duplicate/similar note:', note.title);
          return false;
        }
      });
    }

    res.json({ notes });
  } catch (error) {
    console.error('Error in note endpoint:', error);
    res.status(500).json({ error: 'Failed to generate note' });
  }
});

app.post('/api/chat-local', async (req: Request, res: Response) => {
  try {
    const { message, history, useRag = false } = req.body;
    if (!message && !history) {
      return res.status(400).json({ error: 'Message or history is required' });
    }
    let messages;
    let prompt = message;
    if (useRag) {
      // Compute embedding for the user message using Ollama to match stored embeddings
      const queryEmbedding = await getOllamaEmbedding(message);
      // Retrieve all document chunks
      const allChunks = documentDb.getAllChunks();
      // Compute similarity for each chunk
      const scoredChunks = allChunks.map(chunk => ({
        ...chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
      }));
      // Filter by threshold
      const SIMILARITY_THRESHOLD = 0.7;
      let filteredChunks = scoredChunks.filter(chunk => chunk.similarity >= SIMILARITY_THRESHOLD);
      if (filteredChunks.length === 0) {
        filteredChunks = scoredChunks.sort((a, b) => b.similarity - a.similarity).slice(0, 3);
      } else {
        filteredChunks = filteredChunks.sort((a, b) => b.similarity - a.similarity);
      }
      const topChunks = filteredChunks;
      prompt = `Based on the following sources, please provide a response. For each piece of information you use, cite the source number (e.g., [Source 1], [Source 2], etc.).\n\nFormat all math using LaTeX (use $...$ for inline math and $$...$$ for block math), and use Markdown for all formatting (italics, bold, lists, etc.). Separate paragraphs with double newlines.\n\nSources:\n${topChunks.map((chunk, i) => `[Source ${i + 1}] ${chunk.chunk_text}`).join('\n\n')}\n\nUser question: ${message}\n\nPlease provide a comprehensive response that directly references the sources above.`;
    }
    if (history && Array.isArray(history) && history.length > 0) {
      const last = history[history.length - 1];
      if (!last || last.role !== 'user' || last.content !== message) {
        messages = [...history, { role: 'user', content: prompt }];
      } else {
        messages = history;
      }
    } else {
      messages = [
        { role: 'system', content: 'You are a helpful study assistant. Format your responses using markdown for better readability. Use code blocks, bullet points, and text emphasis where appropriate.' },
        { role: 'user', content: prompt }
      ];
    }
    // Send to Ollama local model
    const ollamaRes = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi3:latest', // You can change to another local model if desired
        messages,
        stream: false
      })
    });
    const data = await ollamaRes.json() as OllamaChatResponse;
    // Ollama returns { message: { role, content }, ... }
    const aiResponse = data.message?.content || data.content || '';
    res.json({ message: aiResponse });
  } catch (error) {
    console.error('Error in chat-local endpoint:', error);
    res.status(500).json({ error: 'Failed to process local chat message' });
  }
});

app.get('/api/notes', (req: Request, res: Response) => {
  try {
    const notes = noteDb.getAllNotes();
    res.json({ notes });
  } catch (error) {
    console.error('Error retrieving notes:', error);
    res.status(500).json({ error: 'Failed to retrieve notes' });
  }
});

app.delete('/api/notes/:id', (req: Request, res: Response) => {
  try {
    const noteId = req.params.id;
    noteDb.deleteNote(noteId);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

app.patch('/api/notes/:id', (req: Request, res: Response) => {
  try {
    const noteId = req.params.id;
    const {
      nextReview,
      interval,
      easiness,
      repetitions,
      lastReview,
      lastPerformance
    } = req.body;

    // Validate input
    if (interval !== undefined && (typeof interval !== 'number' || interval < 0)) {
      return res.status(400).json({ error: 'Invalid interval value' });
    }
    if (easiness !== undefined && (typeof easiness !== 'number' || easiness < 1.3)) {
      return res.status(400).json({ error: 'Invalid easiness value' });
    }
    if (repetitions !== undefined && (typeof repetitions !== 'number' || repetitions < 0)) {
      return res.status(400).json({ error: 'Invalid repetitions value' });
    }
    if (lastPerformance !== undefined && (typeof lastPerformance !== 'number' || lastPerformance < 0 || lastPerformance > 5)) {
      return res.status(400).json({ error: 'Invalid performance value' });
    }

    const note = noteDb.getNote(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Update SRS fields if provided
    if (nextReview !== undefined) note.nextReview = nextReview ? new Date(nextReview) : undefined;
    if (interval !== undefined) note.interval = interval;
    if (easiness !== undefined) note.easiness = easiness;
    if (repetitions !== undefined) note.repetitions = repetitions;
    if (lastReview !== undefined) note.lastReview = lastReview ? new Date(lastReview) : undefined;
    if (lastPerformance !== undefined) note.lastPerformance = lastPerformance;
    
    note.lastModified = new Date();
    noteDb.saveNote(note);

    console.log('Updated note SRS fields:', {
      id: noteId,
      nextReview: note.nextReview,
      interval: note.interval,
      easiness: note.easiness,
      repetitions: note.repetitions,
      lastReview: note.lastReview,
      lastPerformance: note.lastPerformance
    });

    res.json({ note });
  } catch (error) {
    console.error('Error updating note SRS fields:', error);
    res.status(500).json({ error: 'Failed to update note SRS fields' });
  }
});

// Upload PDF, extract text, embed, save
app.post('/api/documents/upload', upload.single('file'), async (req: Request & { file?: Express.Multer.File }, res: Response) => {
  const uploadId = generateUploadId();
  uploadStatus[uploadId] = { status: 'Uploading file...', progress: 0 };
  try {
    const embeddingProvider = req.body.embeddingProvider === 'ollama' ? 'ollama' : 'openai';
    if (!req.file) {
      uploadStatus[uploadId] = { status: 'No file uploaded', progress: 0, error: 'No file uploaded' };
      return res.status(400).json({ error: 'No file uploaded', uploadId });
    }
    uploadStatus[uploadId] = { status: 'Extracting text...', progress: 10 };
    const { originalname, path: filePath } = req.file;
    const dataBuffer = fs.readFileSync(filePath);
    const title = originalname.replace(/\.pdf$/i, '');
    // Use pdfjsLib.getDocument safely for Node.js
    const getDocument = pdfjsLib.getDocument || (pdfjsLib as any).default?.getDocument;
    if (!getDocument) throw new Error('pdfjsLib.getDocument is not available');
    const loadingTask = getDocument({ data: dataBuffer });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;
    let docTextForEmbedding = '';
    let chunkIndex = 0;
    const MAX_EMBEDDING_CHARS = 512;
    const CHUNK_SIZE = 1500;
    const CHUNK_OVERLAP = 200;
    // Save document first, get docId
    const docId = documentDb.saveDocument({ title, originalname, embedding: [], text: '' });
    let totalChunks = 0;
    // First pass: count total chunks for progress
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = (content.items as { str?: string }[]).map((item) => (item.str || '')).join(' ');
      for (let i = 0; i < pageText.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        totalChunks++;
      }
    }
    // Second pass: process and embed (BATCHED + PARALLEL)
    // Collect all chunk info first
    const allChunks: { chunk_index: number; chunk_text: string }[] = [];
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = (content.items as { str?: string }[]).map((item) => (item.str || '')).join(' ');
      for (let i = 0; i < pageText.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
        allChunks.push({ chunk_index: allChunks.length, chunk_text: pageText.slice(i, i + CHUNK_SIZE) });
      }
    }
    // Batching
    const providerBatchSize = embeddingProvider === 'openai' ? 16 : 4;
    const batches = batchArray(allChunks, providerBatchSize);
    const concurrencyLimit = 3;
    let processedChunks = 0;
    // Helper for concurrency
    async function processBatch(batch: { chunk_index: number; chunk_text: string }[]) {
      let embeddings: number[][] = [];
      if (embeddingProvider === 'openai') {
        // Batch request for OpenAI
        const texts = batch.map(c => c.chunk_text.slice(0, MAX_EMBEDDING_CHARS));
        const embeddingRes = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: texts
        });
        embeddings = embeddingRes.data.map(d => d.embedding);
      } else {
        // Ollama: parallel requests for each chunk in the batch
        embeddings = await Promise.all(batch.map(c => getOllamaEmbedding(c.chunk_text.slice(0, MAX_EMBEDDING_CHARS))));
      }
      // Save each chunk immediately
      for (let i = 0; i < batch.length; i++) {
        documentDb.saveChunks(docId, [{ chunk_index: batch[i].chunk_index, chunk_text: batch[i].chunk_text, embedding: embeddings[i] }]);
        processedChunks++;
      }
      // Update status after each batch
      uploadStatus[uploadId] = {
        status: `Embedded ${processedChunks} of ${allChunks.length} chunks...`,
        progress: 10 + Math.floor(80 * (processedChunks / allChunks.length)),
        chunk: processedChunks,
        totalChunks: allChunks.length
      };
      // Log every 50
      if (processedChunks % 50 === 0) {
        console.log(`[Upload] Processed ${processedChunks} of ${allChunks.length} chunks...`);
      }
    }
    // Concurrency control (simple pool)
    async function runBatches() {
      let idx = 0;
      const pool: Promise<void>[] = [];
      while (idx < batches.length) {
        while (pool.length < concurrencyLimit && idx < batches.length) {
          const p = processBatch(batches[idx]);
          pool.push(p);
          idx++;
        }
        await Promise.race(pool);
        // Remove the first resolved promise from the pool
        pool.shift();
      }
      await Promise.all(pool);
    }
    await runBatches();
    // Now update the document-level embedding and text
    let docEmbeddingText = docTextForEmbedding;
    if (docEmbeddingText.length > MAX_EMBEDDING_CHARS) {
      console.warn('[Embedding] Document text truncated for embedding.');
      docEmbeddingText = docEmbeddingText.slice(0, MAX_EMBEDDING_CHARS);
    }
    const embedding = await getEmbedding(docEmbeddingText, embeddingProvider);
    // Use a public method to update document embedding and text
    documentDb.updateDocumentEmbeddingAndText(docId, embedding, docTextForEmbedding);
    fs.unlinkSync(filePath);
    uploadStatus[uploadId] = { status: 'Upload complete!', progress: 100 };
    res.json({ id: docId, title, originalname, uploadId });
  } catch (err) {
    console.error('Upload error:', err);
    uploadStatus[uploadId] = { status: 'Error', progress: 0, error: 'Failed to process document' };
    res.status(500).json({ error: 'Failed to process document', uploadId });
  }
});

// Endpoint for polling upload status
app.get('/api/documents/upload-status/:uploadId', (req, res) => {
  const { uploadId } = req.params;
  res.json(uploadStatus[uploadId] || { status: 'Unknown upload', progress: 0 });
});

// List all documents
app.get('/api/documents', (req, res) => {
  try {
    const docs = documentDb.getAllDocuments();
    res.json({ documents: docs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

// Delete document
app.delete('/api/documents/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    documentDb.deleteDocument(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// --- New endpoint: Get all responses where a document's chunks were used ---
app.get('/api/documents/:id/usage', (req, res) => {
  const docId = Number(req.params.id);
  
  if (!fs.existsSync(ragUsageLogPath)) {
    return res.json([]);
  }
  
  try {
    const log: RAGUsageEntry[] = JSON.parse(fs.readFileSync(ragUsageLogPath, 'utf-8'));
    
    const filtered = log.filter((entry: RAGUsageEntry) => entry.documentId === docId);
    
    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read usage log' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 