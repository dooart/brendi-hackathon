import React, { useState, useEffect, RefObject } from 'react';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';

export interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (msg: string, model: 'openai' | 'local', useRag: boolean) => void;
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  model: 'openai' | 'local';
  embeddingProvider: 'openai' | 'ollama';
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading,
  messagesEndRef,
  model,
  embeddingProvider
}) => {
  const [input, setInput] = useState('');
  const [useRag, setUseRag] = useState(true);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim(), model, useRag);
      setInput('');
    }
  };

  return (
    <div className="chat-panel" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="messages" style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: '24px 0', flex: 1, overflowY: 'auto' }}>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role}`}
            style={{
              maxWidth: '80%',
              margin: message.role === 'assistant' ? '8px 0 8px auto' : '8px auto 8px 0',
              alignSelf: message.role === 'assistant' ? 'flex-end' : 'flex-start',
              background: message.role === 'assistant' ? '#23272f' : '#353b48',
              color: '#e6e6e6',
              borderRadius: 18,
              padding: '18px 26px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
              fontSize: 16,
              wordBreak: 'break-word',
              textAlign: 'left',
            }}
          >
            {message.role === 'assistant' ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : (
              message.content
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message assistant" style={{ maxWidth: '80%', margin: '8px 0 8px auto', alignSelf: 'flex-end', background: '#23272f', color: '#e6e6e6', borderRadius: 18, padding: '12px 18px', fontSize: 16 }}>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 600, margin: '0 auto', padding: '0 0 8px 0' }}>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={useRag}
            onChange={e => setUseRag(e.target.checked)}
          />
          <span className="toggle-slider"></span>
        </label>
        <span style={{ color: '#b0b8c1', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>
          Use Document Retrieval (RAG)
        </span>
      </div>
      <form onSubmit={handleSubmit} className="input-form" style={{ width: '100%', maxWidth: 600, margin: '0 auto', display: 'flex', gap: 8, padding: '0 0 18px 0' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          style={{ flex: 1, fontSize: 16, borderRadius: 16, border: '1px solid #23272f', padding: '10px 16px', background: '#181a20', color: '#e6e6e6', outline: 'none' }}
        />
        <button
          type="submit"
          className="send-button"
          disabled={!input.trim() || isLoading}
          style={{ borderRadius: 16, padding: '10px 20px', fontSize: 16, background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)', color: '#fff', border: 'none', fontWeight: 600, cursor: 'pointer' }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel; 