import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { DocumentManager } from './documents';
import { startNoteDetection, Note } from './notes';
import { NoteDatabase } from './database';
import fetch from 'node-fetch';

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
let lastCreatedNote: Note | null = null;

// Initialize note detection system
const noteDetection = startNoteDetection(openai, (note: Note) => {
  lastCreatedNote = note;
  noteDb.saveNote(note);
  console.log('Note created:', note.title);
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message && !history) {
      return res.status(400).json({ error: 'Message or history is required' });
    }

    let messages;
    if (history && Array.isArray(history) && history.length > 0) {
      // If the last message is not the current user message, append it
      const last = history[history.length - 1];
      if (!last || last.role !== 'user' || last.content !== message) {
        messages = [...history, { role: 'user', content: message }];
      } else {
        messages = history;
      }
    } else {
      messages = [
        {
          role: "system",
          content: "You are a helpful study assistant. Format your responses using markdown for better readability. Use code blocks, bullet points, and text emphasis where appropriate."
        },
        {
          role: "user",
          content: message
        }
      ];
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 