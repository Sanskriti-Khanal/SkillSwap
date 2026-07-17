import FileDropzone from '../../../components/FileDropzone';
import { GOVERNMENT_ID_TYPES } from '../../../constants/tutorApplication';

export default function VerificationStep({ value, onChange, documents, onDocUploaded, onDocRemoved }) {
  const v = value || {};

  function handleChange(e) {
    const { name, value: val, type, checked } = e.target;
    onChange({ [name]: type === 'checkbox' ? checked : val });
  }

  return (
    <div>
      <h2 style={{ marginBottom: 8 }}>Identity Verification</h2>
      <p style={{ marginBottom: 20, fontSize: '.875rem' }}>
        Your government ID is private and visible only to SkillSwap administrators.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Government ID Type *</label>
          <select name="government_id_type" value={v.government_id_type || ''} onChange={handleChange} required>
            <option value="">Select…</option>
            {GOVERNMENT_ID_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Government ID Number *</label>
          <input type="text" name="government_id_number" value={v.government_id_number || ''} onChange={handleChange} required />
        </div>
      </div>

      <FileDropzone category="id_front" label="Upload Front Image *" existingDocuments={documents} onUploaded={onDocUploaded} onRemoved={onDocRemoved} />
      <FileDropzone category="id_back" label="Upload Back Image *" existingDocuments={documents} onUploaded={onDocUploaded} onRemoved={onDocRemoved} />
      <FileDropzone category="selfie" label="Upload Selfie Holding ID *" existingDocuments={documents} onUploaded={onDocUploaded} onRemoved={onDocRemoved} />

      <div className="checkbox-row">
        <input
          type="checkbox"
          id="live_face_verification_requested"
          name="live_face_verification_requested"
          checked={Boolean(v.live_face_verification_requested)}
          onChange={handleChange}
        />
        <label htmlFor="live_face_verification_requested">
          Request live face verification (optional) — an admin may schedule a brief video check.
        </label>
      </div>
    </div>
  );
}
