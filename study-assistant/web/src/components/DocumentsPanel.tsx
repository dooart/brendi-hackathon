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

const DocumentsPanel: React.FC = () => {
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

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadSuccess(null);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const res = await fetch('http://localhost:3001/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
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
  const openModal = async (doc: DocumentMeta) => {
    setModalDoc(doc);
    setModalUsage(null);
    setModalError(null);
    setModalLoading(true);
    try {
      const res = await fetch(`http://localhost:3001/api/documents/${doc.id}/usage`);
      if (!res.ok) throw new Error('Failed to fetch usage');
      const data = await res.json();
      setModalUsage(data);
    } catch (err) {
      setModalError('Failed to load usage data.');
    } finally {
      setModalLoading(false);
    }
  };
  const closeModal = () => {
    setModalDoc(null);
    setModalUsage(null);
    setModalError(null);
    setModalLoading(false);
  };

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
        <div
          className={`upload-area${selectedFile ? ' has-file' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            type="file"
            accept="application/pdf"
            ref={fileInputRef}
            className="upload-input"
            onChange={e => setSelectedFile(e.target.files?.[0] || null)}
            disabled={isUploading}
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
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload Document'}
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
              <h3>Responses & Chunks Used</h3>
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
                      <div className="doc-modal-usage-response-label">Assistant Response:</div>
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