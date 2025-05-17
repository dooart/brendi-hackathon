import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { DocumentManager } from './documents';
import { startNoteDetection, Note } from './notes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const docManager = new DocumentManager();
let lastCreatedNote: Note | null = null;

// Initialize note detection system
const noteDetection = startNoteDetection(openai, (note: Note) => {
  lastCreatedNote = note;
  console.log('Note created:', note.title);
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a helpful study assistant. Format your responses using markdown for better readability. Use code blocks, bullet points, and text emphasis where appropriate."
        },
        {
          role: "user",
          content: message
        }
      ],
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

app.get('/api/notes', (req, res) => {
  try {
    // TODO: Implement note retrieval
    res.json({ notes: [] });
  } catch (error) {
    console.error('Error retrieving notes:', error);
    res.status(500).json({ error: 'Failed to retrieve notes' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 