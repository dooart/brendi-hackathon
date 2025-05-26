import React, { useState, useEffect, RefObject } from 'react';
import { Message } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface RetrievedChunk {
  documentId: number;
  chunkIndex: number;
  text: string;
  similarity: number;
}

export interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (msg: string, mdl: 'gemini' | 'openai' | 'local' | 'deepseek', useRag: boolean) => Promise<void>;
  messagesEndRef: RefObject<HTMLDivElement>;
  model: 'gemini' | 'openai' | 'local' | 'deepseek';
  embeddingProvider: 'openai' | 'ollama';
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  messagesEndRef,
  model,
  embeddingProvider
}) => {
  const [input, setInput] = useState('');
  const [useRag, setUseRag] = useState(false);
  const [showChunksModal, setShowChunksModal] = useState(false);
  const [retrievedChunks, setRetrievedChunks] = useState<RetrievedChunk[]>([]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const messageToSend = input;
    setInput(''); // Clear input immediately
    await onSendMessage(messageToSend, model, useRag);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesEndRef]);

  return (
    <div className="chat-panel" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div className="messages" style={{ width: '100%', maxWidth: 800, margin: '0 auto', padding: '24px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role === 'assistant' ? 'assistant' : 'user'}`}
            style={{
              maxWidth: 700,
              width: '95%',
              margin: message.role === 'user' ? '8px 0 8px auto' : '8px auto 8px 0',
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              background: message.role === 'user'
                ? 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)'
                : '#353b48',
              color: message.role === 'user' ? '#fff' : '#e6e6e6',
              borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding: '18px 26px',
              boxShadow: message.role === 'user'
                ? '0 2px 8px #4a9eff44'
                : '0 2px 8px rgba(0,0,0,0.07)',
              fontSize: 16,
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              textAlign: 'left',
              position: 'relative',
              overflowX: 'hidden',
            }}
          >
            {/* User bubble pointer */}
            {message.role === 'user' && (
              <span style={{
                position: 'absolute',
                right: -12,
                bottom: 12,
                width: 0,
                height: 0,
                borderTop: '10px solid transparent',
                borderBottom: '10px solid transparent',
                borderLeft: '12px solid #7f53ff',
                filter: 'drop-shadow(0 2px 4px #4a9eff44)'
              }} />
            )}
            <MarkdownRenderer content={message.content} />
            {message.retrievedChunks && message.retrievedChunks.length > 0 && (
              <button
                onClick={() => {
                  if (message.retrievedChunks) {
                    setRetrievedChunks(message.retrievedChunks);
                    setShowChunksModal(true);
                  }
                }}
                style={{
                  background: 'none',
                  border: '1px solid #4a9eff33',
                  color: '#4a9eff',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  marginTop: 8,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                View Sources ({message.retrievedChunks.length})
              </button>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="message assistant" style={{ maxWidth: '80%', margin: '8px auto 8px 0', alignSelf: 'flex-start', background: '#353b48', color: '#e6e6e6', borderRadius: 18, padding: '18px 26px', fontSize: 16 }}>
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Retrieved Chunks Modal */}
      {showChunksModal && (
        <div className="doc-modal-overlay" onClick={() => setShowChunksModal(false)}>
          <div className="doc-modal" onClick={e => e.stopPropagation()}>
            <button className="doc-modal-close" onClick={() => setShowChunksModal(false)}>×</button>
            <h2 className="doc-modal-title">Retrieved Sources</h2>
            <div className="doc-modal-usage-list">
              {retrievedChunks.map((chunk, index) => (
                <div key={index} className="doc-modal-usage-entry">
                  <div className="doc-modal-usage-time">
                    Similarity: {(chunk.similarity * 100).toFixed(2)}%
                  </div>
                  <div className="doc-modal-usage-chunk">
                    <span className="doc-modal-usage-chunk-index">Document {chunk.documentId}, Chunk {chunk.chunkIndex}:</span>
                    <span className="doc-modal-usage-chunk-text">{chunk.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 600, margin: '0 auto', padding: '0 0 8px 0' }}>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={useRag}
            onChange={(e) => setUseRag(e.target.checked)}
          />
          <span className="toggle-slider"></span>
        </label>
        <span style={{ color: '#b0b8c1', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>
          Use Document Retrieval (RAG)
        </span>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="input-form" style={{ width: '100%', maxWidth: 600, margin: '0 auto', display: 'flex', gap: 8, padding: '0 0 18px 0' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          style={{ flex: 1, fontSize: 16, borderRadius: 16, border: '1px solid #23272f', padding: '10px 16px', background: '#181a20', color: '#e6e6e6', outline: 'none', resize: 'vertical', minHeight: 40, maxHeight: 180 }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
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