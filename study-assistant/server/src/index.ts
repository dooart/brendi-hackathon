import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { DocumentManager } from './documents';
import { startNoteDetection, Note } from './notes';
import { NoteDatabase } from './database';
import fetch from 'node-fetch';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import type { Request } from 'express';
import DocumentDatabase from './documentDatabase';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

// Initialize note detection system
const noteDetection = startNoteDetection(openai, (note: Note) => {
  lastCreatedNote = note;
  noteDb.saveNote(note);
  console.log('Note created:', note.title);
});

// In-memory upload status map for progress feedback
const uploadStatus: Record<string, { status: string; progress: number; error?: string }> = {};

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

function chunkText(text: string, chunkSize = 800): string[] {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = i + chunkSize;
    // Try to break at a paragraph or sentence boundary
    let nextBreak = text.lastIndexOf('\n', end);
    if (nextBreak <= i) nextBreak = text.indexOf('\n', end);
    if (nextBreak > i && nextBreak - i < chunkSize * 1.5) end = nextBreak;
    chunks.push(text.slice(i, end).trim());
    i = end;
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
    } catch {}
  }
  log.push({ documentId, chunkIndexes, response, timestamp });
  fs.writeFileSync(ragUsageLogPath, JSON.stringify(log, null, 2));
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, useRag } = req.body;
    if (!message && !history) {
      return res.status(400).json({ error: 'Message or history is required' });
    }

    let ragContext = '';
    let usedRagChunks: { document_id: number; chunk_index: number; chunk_text: string }[] = [];
    if (useRag) {
      // Generate embedding for the query
      const queryEmbeddingRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message.slice(0, 8000)
      });
      const queryEmbedding = queryEmbeddingRes.data[0].embedding;
      // Get all chunks and their embeddings
      const chunks = documentDb.getAllChunks();
      const scored = chunks.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding)
      }));
      scored.sort((a, b) => b.score - a.score);
      const topChunks = scored.slice(0, 3).filter(d => d.score > 0.2);
      if (topChunks.length > 0) {
        ragContext = topChunks.map(chunk => {
          const meta = documentDb.getChunkWithDocMeta(chunk.id);
          return meta ? `Source: ${meta.title} (${meta.originalname})\n${chunk.chunk_text}` : chunk.chunk_text;
        }).join('\n---\n');
        // Track which document and chunk indexes were used
        usedRagChunks = topChunks.map(chunk => ({
          document_id: chunk.document_id,
          chunk_index: chunk.chunk_index,
          chunk_text: chunk.chunk_text
        }));
      }
    } else {
      console.log('[RAG] RAG is disabled for this request');
    }

    // Use history if provided, otherwise fallback to old behavior
    const messages = history && Array.isArray(history) && history.length > 0
      ? history
      : [
          {
            role: "system",
            content: "You are a helpful study assistant. Format your responses using markdown for better readability. Use code blocks, bullet points, and text emphasis where appropriate."
          },
          {
            role: "user",
            content: message
          }
        ];

    // Inject RAG context as a system message if present
    let finalMessages = messages;
    if (ragContext) {
      finalMessages = [
        { role: 'system', content: `You have access to the following documents for context. When using information from these documents, ALWAYS cite the document title and any available metadata in your answer. Make it clear to the user which information comes from which document.\n\n${ragContext}` },
        ...messages
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: finalMessages,
      temperature: 0.7,
      max_tokens: 500
    });

    const aiResponse = response.choices[0].message.content;
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    // Log RAG usage if any
    if (usedRagChunks.length > 0) {
      // Group by document_id
      const byDoc: { [docId: number]: RAGChunk[] } = {};
      usedRagChunks.forEach(c => {
        if (!byDoc[c.document_id]) byDoc[c.document_id] = [];
        byDoc[c.document_id].push({ chunk_index: c.chunk_index, chunk_text: c.chunk_text });
      });
      Object.entries(byDoc).forEach(([docId, chunks]) => {
        logRagUsage(Number(docId), chunks, aiResponse, Date.now());
      });
    }

    // Process the response for note detection
    await noteDetection.process(
      [
        { role: 'user', content: message },
        { role: 'assistant', content: aiResponse }
      ],
      Date.now().toString()
    );

    // Send response with note if one was created
    const responseData: { message: string; note?: Note } = {
      message: aiResponse
    };

    if (lastCreatedNote) {
      responseData.note = lastCreatedNote;
      lastCreatedNote = null;
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

app.post('/api/chat-local', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message && !history) {
      return res.status(400).json({ error: 'Message or history is required' });
    }
    let messages;
    if (history && Array.isArray(history) && history.length > 0) {
      const last = history[history.length - 1];
      if (!last || last.role !== 'user' || last.content !== message) {
        messages = [...history, { role: 'user', content: message }];
      } else {
        messages = history;
      }
    } else {
      messages = [
        { role: 'system', content: 'You are a helpful study assistant. Format your responses using markdown for better readability. Use code blocks, bullet points, and text emphasis where appropriate.' },
        { role: 'user', content: message }
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
    const data = await ollamaRes.json();
    // Ollama returns { message: { role, content }, ... }
    const aiResponse = data.message?.content || data.message || '';
    res.json({ message: aiResponse });
  } catch (error) {
    console.error('Error in chat-local endpoint:', error);
    res.status(500).json({ error: 'Failed to process local chat message' });
  }
});

app.get('/api/notes', (req, res) => {
  try {
    const notes = noteDb.getAllNotes();
    res.json({ notes });
  } catch (error) {
    console.error('Error retrieving notes:', error);
    res.status(500).json({ error: 'Failed to retrieve notes' });
  }
});

app.delete('/api/notes/:id', (req, res) => {
  try {
    const noteId = req.params.id;
    noteDb.deleteNote(noteId);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

app.patch('/api/notes/:id', (req, res) => {
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
    res.json({ note });
  } catch (error) {
    console.error('Error updating note SRS fields:', error);
    res.status(500).json({ error: 'Failed to update note SRS fields' });
  }
});

// Upload PDF, extract text, embed, save
app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
  const uploadId = generateUploadId();
  uploadStatus[uploadId] = { status: 'Uploading file...', progress: 0 };
  try {
    const reqWithFile = req as Request & { file?: Express.Multer.File };
    if (!reqWithFile.file) {
      uploadStatus[uploadId] = { status: 'No file uploaded', progress: 0, error: 'No file uploaded' };
      return res.status(400).json({ error: 'No file uploaded', uploadId });
    }
    uploadStatus[uploadId] = { status: 'Extracting text...', progress: 10 };
    const { originalname, path: filePath } = reqWithFile.file;
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;
    const title = originalname.replace(/\.pdf$/i, '');
    uploadStatus[uploadId] = { status: 'Creating document embedding...', progress: 20 };
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000)
    });
    const embedding = embeddingRes.data[0].embedding;
    uploadStatus[uploadId] = { status: 'Splitting into chunks...', progress: 30 };
    const chunks = chunkText(text, 800);
    const BATCH_SIZE = 100;
    const chunkBatches = batchArray(chunks, BATCH_SIZE);
    let allEmbeddings: number[][] = [];
    let batchNum = 0;
    for (const batch of chunkBatches) {
      uploadStatus[uploadId] = { status: `Creating chunk embeddings (batch ${batchNum + 1} of ${chunkBatches.length})...`, progress: 30 + Math.floor(60 * (batchNum / chunkBatches.length)) };
      const batchRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch
      });
      allEmbeddings = allEmbeddings.concat(batchRes.data.map(d => d.embedding));
      batchNum++;
    }
    uploadStatus[uploadId] = { status: 'Saving to database...', progress: 95 };
    const chunkRecords = chunks.map((chunk, idx) => ({ chunk_index: idx, chunk_text: chunk, embedding: allEmbeddings[idx] }));
    const docId = documentDb.saveDocumentWithChunks({ title, originalname, embedding, text, chunks: chunkRecords });
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
  if (!fs.existsSync(ragUsageLogPath)) return res.json([]);
  try {
    const log: RAGUsageEntry[] = JSON.parse(fs.readFileSync(ragUsageLogPath, 'utf-8'));
    const filtered = log.filter((entry: RAGUsageEntry) => entry.documentId === docId);
    res.json(filtered);
  } catch {
    res.status(500).json({ error: 'Failed to read usage log' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 