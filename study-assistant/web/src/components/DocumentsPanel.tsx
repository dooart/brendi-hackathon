import React, { useState, useEffect, useRef } from 'react';

interface DocumentMeta {
  id: number;
  title: string;
  filename: string;
  originalname: string;
  created_at: string;
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
              <div className="document-card" key={doc.id}>
                <div className="document-card-header">
                  <span className="document-icon">📄</span>
                  <span className="document-title" title={doc.title}>{doc.title}</span>
                </div>
                <div className="document-meta" title={doc.originalname}>{doc.originalname}</div>
                <div className="document-meta-time">🕒 {new Date(doc.created_at).toLocaleString()}</div>
                <button
                  className="document-delete"
                  onClick={() => handleDelete(doc.id)}
                  title="Delete document"
                >🗑️</button>
              </div>
            ))}
          </div>
        )}
        {deleteError && <div className="upload-error">{deleteError}</div>}
      </div>
    </div>
  );
};

export default DocumentsPanel; 