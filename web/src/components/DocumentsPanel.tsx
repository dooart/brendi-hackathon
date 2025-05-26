import React, { useState, useEffect, useRef } from 'react';

interface DocumentMeta {
  id: number;
  title: string;
  filename: string;
  originalname: string;
  created_at: string;
}

interface RAGChunk {
  chunk_index: number;
  chunk_text: string;
}
interface RAGUsageEntry {
  documentId: number;
  chunkIndexes: RAGChunk[];
  response: string;
  timestamp: number;
}

const DocumentsPanel: React.FC<{ embeddingProvider: 'openai' | 'ollama' }> = ({ embeddingProvider }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal state
  const [modalDoc, setModalDoc] = useState<DocumentMeta | null>(null);
  const [modalUsage, setModalUsage] = useState<RAGUsageEntry[] | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const modalRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string>('');
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const uploadStatusInterval = useRef<NodeJS.Timeout | null>(null);

  const [detailedProgress, setDetailedProgress] = useState<{
    chunk?: number;
    totalChunks?: number;
    subChunk?: number;
    totalSubChunks?: number;
    splitChunks?: number;
  }>();

  const fetchDocuments = async () => {
    setIsLoadingDocs(true);
    setDeleteError(null);
    try {
      const res = await fetch('http://localhost:3001/api/documents');
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setDeleteError('Failed to fetch documents.');
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // Poll upload status
  useEffect(() => {
    if (!currentUploadId) return;
    const poll = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/documents/upload-status/${currentUploadId}`);
        const data = await res.json();
        setUploadProgress(data.progress || 0);
        setUploadStatusMsg(data.status || '');
        setDetailedProgress({
          chunk: data.chunk,
          totalChunks: data.totalChunks,
          subChunk: data.subChunk,
          totalSubChunks: data.totalSubChunks,
          splitChunks: data.splitChunks
        });
        if (data.progress >= 100 || data.error) {
          setTimeout(() => {
            setCurrentUploadId(null);
            setUploadProgress(0);
            setUploadStatusMsg('');
            setDetailedProgress(undefined);
          }, 2000);
        }
      } catch {
        setUploadStatusMsg('Failed to get upload status');
      }
    };
    uploadStatusInterval.current = setInterval(poll, 500);
    return () => {
      if (uploadStatusInterval.current) clearInterval(uploadStatusInterval.current);
    };
  }, [currentUploadId]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadSuccess(null);
    setUploadError(null);
    setUploadProgress(0);
    setUploadStatusMsg('Starting upload...');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('embeddingProvider', embeddingProvider);
      const res = await fetch('http://localhost:3001/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error('Upload failed');
      setCurrentUploadId(data.uploadId);
      setUploadSuccess('Upload successful!');
      setSelectedFile(null);
      fetchDocuments();
    } catch (err) {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteError(null);
    try {
      const res = await fetch(`http://localhost:3001/api/documents/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      fetchDocuments();
    } catch (err) {
      setDeleteError('Failed to delete document.');
    }
  };

  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.originalname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Drag and drop upload
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Modal logic
  const fetchModalUsage = async (docId: number) => {
    console.log(`[DocumentsPanel] Fetching usage for document ${docId}`);
    try {
      const res = await fetch(`http://localhost:3001/api/documents/${docId}/usage`);
      if (!res.ok) throw new Error('Failed to fetch usage');
      const data = await res.json();
      console.log(`[DocumentsPanel] Received usage data:`, data);
      setModalUsage(data);
    } catch (err) {
      console.error(`[DocumentsPanel] Error fetching usage:`, err);
      setModalError('Failed to load usage data.');
    } finally {
      setModalLoading(false);
    }
  };

  const openModal = async (doc: DocumentMeta) => {
    console.log(`[DocumentsPanel] Opening modal for document:`, doc);
    setModalDoc(doc);
    setModalUsage(null);
    setModalError(null);
    setModalLoading(true);
    await fetchModalUsage(doc.id);

    // Set up refresh interval
    modalRefreshInterval.current = setInterval(() => {
      if (modalDoc) {
        console.log(`[DocumentsPanel] Refreshing usage data for document ${modalDoc.id}`);
        fetchModalUsage(modalDoc.id);
      }
    }, 5000); // Refresh every 5 seconds
  };

  const closeModal = () => {
    setModalDoc(null);
    setModalUsage(null);
    setModalError(null);
    setModalLoading(false);
    // Clear refresh interval
    if (modalRefreshInterval.current) {
      clearInterval(modalRefreshInterval.current);
      modalRefreshInterval.current = null;
    }
  };

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (modalRefreshInterval.current) {
        clearInterval(modalRefreshInterval.current);
      }
    };
  }, []);

  // Close modal on outside click
  useEffect(() => {
    if (!modalDoc) return;
    const handler = (e: MouseEvent) => {
      const modal = document.getElementById('doc-modal');
      if (modal && !modal.contains(e.target as Node)) {
        closeModal();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [modalDoc]);

  return (
    <div className="documents-container">
      <h2 className="documents-title">📚 Document Library</h2>
      <div className="documents-upload-section">
        {/* Progress bar and status */}
        {(isUploading || currentUploadId) && (
          <div style={{ width: '100%', marginBottom: 18 }}>
            <div style={{ height: 12, background: '#23272f', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
              <div
                style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  background: uploadProgress >= 100 ? 'linear-gradient(90deg, #00c853 0%, #b2ff59 100%)' : 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
                  transition: 'width 0.3s'
                }}
              />
            </div>
            <div style={{ color: uploadProgress >= 100 ? '#00c853' : '#7f53ff', fontSize: 15, minHeight: 18, fontWeight: 500 }}>
              {uploadStatusMsg}
              {uploadProgress >= 100 && ' (Complete!)'}
            </div>
            {detailedProgress && (
              <div style={{ color: '#b0b8c1', fontSize: 14, marginTop: 2 }}>
                {typeof detailedProgress.chunk === 'number' && typeof detailedProgress.totalChunks === 'number' && detailedProgress.totalChunks > 0 && (
                  <span>
                    <b>Embedding chunk {detailedProgress.chunk}/{detailedProgress.totalChunks}</b>
                  </span>
                )}
                {typeof detailedProgress.subChunk === 'number' && detailedProgress.totalSubChunks && detailedProgress.totalSubChunks > 1 && (
                  <span> (sub-chunk {detailedProgress.subChunk}/{detailedProgress.totalSubChunks})</span>
                )}
                {typeof detailedProgress.splitChunks === 'number' && detailedProgress.splitChunks > 0 && (
                  <span> | <b>{detailedProgress.splitChunks} chunk(s) required splitting/truncation</b></span>
                )}
              </div>
            )}
          </div>
        )}
        <div
          className={`upload-area${selectedFile ? ' has-file' : ''}`}
          onClick={() => !isUploading && !currentUploadId && fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{ opacity: isUploading || currentUploadId ? 0.6 : 1, pointerEvents: isUploading || currentUploadId ? 'none' : 'auto' }}
        >
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            className="upload-input"
            onChange={e => setSelectedFile(e.target.files?.[0] || null)}
            disabled={isUploading || !!currentUploadId}
          />
          <div className="upload-icon">📤</div>
          <div className="upload-text">
            {selectedFile ? (
              <span className="selected-file">{selectedFile.name}</span>
            ) : (
              <>
                <span className="upload-cta">Click or drag a PDF here to upload</span>
                <span className="upload-hint">Max 1 file at a time</span>
              </>
            )}
          </div>
        </div>
        <button
          className="upload-btn"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || !!currentUploadId}
        >
          {isUploading || currentUploadId ? 'Uploading...' : 'Upload Document'}
        </button>
        {uploadSuccess && <div className="upload-success">{uploadSuccess}</div>}
        {uploadError && <div className="upload-error">{uploadError}</div>}
      </div>
      <div className="documents-list-section">
        <div className="documents-list-header">
          <h3>Your Documents</h3>
          <input
            type="text"
            className="documents-search"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {isLoadingDocs ? (
          <div className="documents-loading">Loading...</div>
        ) : filteredDocuments.length === 0 ? (
          <div className="documents-empty">
            {searchQuery ? 'No matching documents found.' : 'No documents uploaded yet.'}
          </div>
        ) : (
          <div className="documents-grid">
            {filteredDocuments.map(doc => (
              <div className="document-card" key={doc.id} onClick={() => openModal(doc)} style={{ cursor: 'pointer' }}>
                <div className="document-card-header">
                  <span className="document-icon">📄</span>
                  <span className="document-title" title={doc.title}>{doc.title}</span>
                </div>
                <div className="document-meta" title={doc.originalname}>{doc.originalname}</div>
                <div className="document-meta-time">🕒 {new Date(doc.created_at).toLocaleString()}</div>
                <button
                  className="document-delete"
                  onClick={e => { e.stopPropagation(); handleDelete(doc.id); }}
                  title="Delete document"
                >🗑️</button>
              </div>
            ))}
          </div>
        )}
        {deleteError && <div className="upload-error">{deleteError}</div>}
      </div>

      {/* Modal for document usage */}
      {modalDoc && (
        <div className="doc-modal-overlay">
          <div className="doc-modal" id="doc-modal">
            <button className="doc-modal-close" onClick={closeModal} title="Close">×</button>
            <h2 className="doc-modal-title">{modalDoc.title}</h2>
            <div className="doc-modal-meta">{modalDoc.originalname}</div>
            <div className="doc-modal-meta-time">🕒 {new Date(modalDoc.created_at).toLocaleString()}</div>
            <div className="doc-modal-section">
              <h3>Usage History</h3>
              {modalLoading ? (
                <div className="documents-loading">Loading...</div>
              ) : modalError ? (
                <div className="upload-error">{modalError}</div>
              ) : !modalUsage || modalUsage.length === 0 ? (
                <div className="documents-empty">No responses have used this document yet.</div>
              ) : (
                <div className="doc-modal-usage-list">
                  {modalUsage.map((entry, idx) => (
                    <div className="doc-modal-usage-entry" key={idx}>
                      <div className="doc-modal-usage-time">{new Date(entry.timestamp).toLocaleString()}</div>
                      <details>
                        <summary className="doc-modal-usage-response-label">
                          Show Response & Chunks
                        </summary>
                      <div className="doc-modal-usage-response">{entry.response}</div>
                      <div className="doc-modal-usage-chunks-label">Chunks used:</div>
                      <div className="doc-modal-usage-chunks">
                        {entry.chunkIndexes.map((chunk, cidx) => (
                          <div className="doc-modal-usage-chunk" key={cidx}>
                            <span className="doc-modal-usage-chunk-index">Chunk {chunk.chunk_index}:</span>
                            <span className="doc-modal-usage-chunk-text">{chunk.chunk_text}</span>
                          </div>
                        ))}
                      </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsPanel; 