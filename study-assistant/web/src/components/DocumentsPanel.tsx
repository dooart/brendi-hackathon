import React, { useState, useEffect } from 'react';

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

  return (
    <div style={{ padding: 32 }}>
      <h2 style={{ color: '#4a9eff', fontWeight: 700, marginBottom: 18 }}>Upload PDF Documents</h2>
      <div style={{
        background: '#23272f',
        borderRadius: 16,
        padding: '32px 28px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
        maxWidth: 420,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18
      }}>
        <input
          type="file"
          accept="application/pdf"
          onChange={e => setSelectedFile(e.target.files?.[0] || null)}
          style={{ marginBottom: 12 }}
          disabled={isUploading}
        />
        {selectedFile && (
          <div style={{ color: '#b0b8c1', fontSize: 15 }}>
            Selected file: <span style={{ color: '#7f53ff', fontWeight: 600 }}>{selectedFile.name}</span>
          </div>
        )}
        <button
          style={{
            background: 'linear-gradient(90deg, #4a9eff 0%, #7f53ff 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 24px',
            fontWeight: 600,
            fontSize: 16,
            cursor: selectedFile && !isUploading ? 'pointer' : 'not-allowed',
            opacity: selectedFile && !isUploading ? 1 : 0.6
          }}
          disabled={!selectedFile || isUploading}
          onClick={handleUpload}
        >{isUploading ? 'Uploading...' : 'Upload'}</button>
        {isUploading && <div style={{ color: '#7f53ff', fontSize: 15 }}>Uploading...</div>}
        {uploadSuccess && <div style={{ color: '#22c55e', fontSize: 15 }}>{uploadSuccess}</div>}
        {uploadError && <div style={{ color: '#ff5c5c', fontSize: 15 }}>{uploadError}</div>}
      </div>
      <div style={{ marginTop: 40 }}>
        <h3 style={{ color: '#b0b8c1', fontWeight: 600, fontSize: 18 }}>Uploaded Documents</h3>
        {isLoadingDocs ? (
          <div style={{ color: '#7f53ff', fontSize: 15 }}>Loading...</div>
        ) : documents.length === 0 ? (
          <div style={{ color: '#b0b8c1', fontSize: 15, marginTop: 12 }}>
            <em>No documents uploaded yet.</em>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {documents.map(doc => (
              <li key={doc.id} style={{
                background: '#23272f',
                borderRadius: 12,
                marginBottom: 14,
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 4px #4a9eff11',
                border: '1px solid #4a9eff22',
              }}>
                <div>
                  <div style={{ color: '#7f53ff', fontWeight: 600, fontSize: 16 }}>{doc.title}</div>
                  <div style={{ color: '#b0b8c1', fontSize: 13 }}>{doc.originalname}</div>
                  <div style={{ color: '#b0b8c1', fontSize: 12, marginTop: 2 }}>Uploaded: {new Date(doc.created_at).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ff5c5c',
                    fontSize: 20,
                    cursor: 'pointer',
                    marginLeft: 18,
                  }}
                  title="Delete document"
                >×</button>
              </li>
            ))}
          </ul>
        )}
        {deleteError && <div style={{ color: '#ff5c5c', fontSize: 15 }}>{deleteError}</div>}
      </div>
    </div>
  );
};

export default DocumentsPanel; 