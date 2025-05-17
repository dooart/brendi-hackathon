import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { createOpenAIClient, getAIResponse } from './openai';
import { NoteDatabase } from './database';
import { DocumentManager } from './documents';

// Load environment variables
config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize services
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  throw new Error('OpenAI API key is required');
}

const db = new NoteDatabase();
const docManager = new DocumentManager(apiKey, db);
let conversation: { role: 'user' | 'assistant'; content: string }[] = [];

// Chat endpoint
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Add user message to conversation
    conversation.push({ role: 'user', content: message });

    // Get AI response
    const openai = createOpenAIClient(apiKey);
    const response = await getAIResponse(openai, conversation, docManager);

    // Add assistant response to conversation
    conversation.push({ role: 'assistant', content: response });

    // Keep only last 10 messages
    if (conversation.length > 10) {
      conversation = conversation.slice(-10);
    }

    res.json({ response });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Document management endpoints
app.post('/api/documents/load', async (req: Request, res: Response) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    await docManager.loadPDF(filePath);
    res.json({ message: 'Document loaded successfully' });
  } catch (error) {
    console.error('Error loading document:', error);
    res.status(500).json({ error: 'Failed to load document' });
  }
});

app.get('/api/documents', (req: Request, res: Response) => {
  try {
    const documents = docManager.getLoadedDocuments();
    res.json({ documents });
  } catch (error) {
    console.error('Error listing documents:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

app.delete('/api/documents/:fileName', async (req: Request, res: Response) => {
  try {
    const { fileName } = req.params;
    await docManager.removeDocument(fileName);
    res.json({ message: 'Document removed successfully' });
  } catch (error) {
    console.error('Error removing document:', error);
    res.status(500).json({ error: 'Failed to remove document' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 