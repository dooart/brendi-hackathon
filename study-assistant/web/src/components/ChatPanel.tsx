import React, { useState, useEffect, RefObject } from 'react';
import { Message } from '../types';
import ReactMarkdown from 'react-markdown';

interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (message: string, model: 'openai' | 'local') => void;
  isLoading: boolean;
  messagesEndRef: RefObject<HTMLDivElement>;
  model: 'openai' | 'local';
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading,
  messagesEndRef,
  model
}) => {
  const [input, setInput] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim(), model);
      setInput('');
    }
  };

  return (
    <div className="chat-panel">
      <div className="messages">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role}`}
          >
            {message.role === 'assistant' ? (
              <ReactMarkdown>{message.content}</ReactMarkdown>
            ) : (
              message.content
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message assistant">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button
          type="submit"
          className="send-button"
          disabled={!input.trim() || isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel; 