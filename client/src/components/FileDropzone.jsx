import { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle2 } from 'lucide-react';
import api, { getErrorMessage } from '../utils/api';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

// Lightweight client-side magic-byte check — UX only (fails fast before wasting an
// upload), never authoritative. The server independently re-checks the real uploaded
// bytes in POST /documents/confirm and is the only check that's actually trusted.
async function matchesDeclaredType(file) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (file.type === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === 'image/png') return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b);
  if (file.type === 'application/pdf') return [0x25, 0x50, 0x44, 0x46].every((b, i) => bytes[i] === b);
  return false;
}

export default function FileDropzone({ category, label, hint, existingDocuments = [], onUploaded, onRemoved }) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(null); // null | 0-100
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const docsForCategory = existingDocuments.filter((d) => d.category === category);

  async function handleFile(file) {
    setError(null);
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError('Only JPG, PNG, or PDF files are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File must be 10MB or smaller.');
      return;
    }
    if (!(await matchesDeclaredType(file))) {
      setError('Invalid file format. The uploaded file content does not match the selected file type.');
      return;
    }

    setProgress(0);
    try {
      const presignRes = await api.post('/tutor-applications/documents/presign', {
        category, mime_type: file.type, size_bytes: file.size, filename: file.name,
      });
      const { timestamp, public_id, type, signature, apiKey, cloudName } = presignRes.data;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('public_id', public_id);
      formData.append('type', type);

      const uploadRes = await axios.post(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, formData, {
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        },
      });

      const confirmRes = await api.post('/tutor-applications/documents/confirm', {
        storage_key: uploadRes.data.public_id,
        resource_type: uploadRes.data.resource_type,
        category,
        original_filename: file.name,
      });

      setProgress(null);
      onUploaded?.(confirmRes.data);
    } catch (err) {
      setProgress(null);
      if (err.response?.status === 503) {
        setError('File storage is not configured yet. Please try again later or contact support.');
      } else {
        setError(getErrorMessage(err));
      }
    }
  }

  async function handleRemove(docId) {
    try {
      await api.delete(`/tutor-applications/documents/${docId}`);
      onRemoved?.(docId);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="form-group">
      <label>{label}</label>
      <div
        className={`dropzone ${dragOver ? 'dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
        />
        <div className="dropzone-icon"><UploadCloud aria-hidden="true" /></div>
        <div>Drag & drop, or click to browse</div>
        {hint && <div className="dropzone-hint">{hint}</div>}
        <div className="dropzone-hint">JPG, PNG, or PDF · max 10MB</div>
        {progress !== null && (
          <div className="dropzone-progress">
            <div className="dropzone-progress-fill" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>
      {error && <div className="alert alert-error" style={{ marginTop: 10, marginBottom: 0 }}>{error}</div>}
      {docsForCategory.map((doc) => (
        <div key={doc._id} className="uploaded-file">
          <span className="uploaded-file-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 style={{ width: 15, height: 15, flexShrink: 0 }} strokeWidth={1.75} color="var(--success)" aria-hidden="true" />
            {doc.original_filename}
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleRemove(doc._id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}
