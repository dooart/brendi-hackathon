import fetch from 'node-fetch';

interface OllamaResponse {
  message?: {
    content: string;
  };
  content?: string;
}

export async function generateLocalResponse(
  message: string,
  history: { role: string; content: string }[]
): Promise<string> {
  try {
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

    const ollamaRes = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'phi3:latest',
        messages,
        stream: false
      })
    });

    if (!ollamaRes.ok) {
      throw new Error('Failed to get response from Ollama');
    }

    const data = await ollamaRes.json() as OllamaResponse;
    return data.message?.content || data.content || '';
  } catch (error) {
    console.error('Error in local response generation:', error);
    throw error;
  }
} 