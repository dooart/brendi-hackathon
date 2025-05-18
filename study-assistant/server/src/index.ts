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

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, useRag } = req.body;
    if (!message && !history) {
      return res.status(400).json({ error: 'Message or history is required' });
    }

    let ragContext = '';
    if (useRag) {
      // Generate embedding for the query
      const queryEmbeddingRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: message.slice(0, 8000)
      });
      const queryEmbedding = queryEmbeddingRes.data[0].embedding;
      // Get all docs and their embeddings
      const docs = documentDb.getAllDocuments();
      const docRows = docs.map(doc => {
        const row = documentDb.getEmbeddingAndText(doc.id);
        if (!row) return null;
        return { ...doc, embedding: row.embedding, text: row.text };
      }).filter(Boolean);
      // Compute similarity
      const scored = docRows
        .filter((doc): doc is typeof docRows[0] & { embedding: number[]; text: string } => !!doc && !!doc.embedding && !!doc.text)
        .map(doc => ({ ...doc, score: cosineSimilarity(queryEmbedding, doc.embedding) }));
      scored.sort((a, b) => b.score - a.score);
      const topDocs = scored.slice(0, 2).filter(d => d.score > 0.2);
      if (topDocs.length > 0) {
        ragContext = topDocs.map(d => `Document: ${d.title}\n${d.text ? d.text.slice(0, 2000) : ''}`).join('\n---\n');
      }
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
  try {
    const reqWithFile = req as Request & { file?: Express.Multer.File };
    if (!reqWithFile.file) return res.status(400).json({ error: 'No file uploaded' });
    const { originalname, path: filePath } = reqWithFile.file;
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;
    const title = originalname.replace(/\.pdf$/i, '');
    // Generate embedding with OpenAI
    const embeddingRes = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000) // Truncate for embedding API limits
    });
    const embedding = embeddingRes.data[0].embedding;
    // Save to new documents DB
    const docId = documentDb.saveDocument({ title, originalname, embedding, text });
    // Delete the uploaded file after processing
    fs.unlinkSync(filePath);
    res.json({ id: docId, title, originalname });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to process document' });
  }
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 