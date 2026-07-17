import FileDropzone from '../../../components/FileDropzone';
import { EDUCATION_LEVELS } from '../../../constants/tutorApplication';

export default function EducationStep({ value, onChange, documents, onDocUploaded, onDocRemoved }) {
  const v = value || {};

  function handleChange(e) {
    const { name, value: val, type, checked } = e.target;
    onChange({ [name]: type === 'checkbox' ? checked : val });
  }

  function handleCertNameChange(idx, field, val) {
    const certs = [...(v.certifications || [])];
    certs[idx] = { ...certs[idx], [field]: val };
    onChange({ certifications: certs });
  }

  function addCertification() {
    onChange({ certifications: [...(v.certifications || []), { name: '', issuing_organization: '' }] });
  }

  function removeCertification(idx) {
    onChange({ certifications: (v.certifications || []).filter((_, i) => i !== idx) });
  }

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Education</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Highest Education *</label>
          <select name="highest_education" value={v.highest_education || ''} onChange={handleChange} required>
            <option value="">Select…</option>
            {EDUCATION_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Graduation Year</label>
          <input type="number" name="graduation_year" value={v.graduation_year || ''} onChange={handleChange} min="1950" max="2100" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Institution</label>
          <input type="text" name="institution_name" value={v.institution_name || ''} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Field of Study</label>
          <input type="text" name="field_of_study" value={v.field_of_study || ''} onChange={handleChange} />
        </div>
      </div>

      <div className="checkbox-row">
        <input type="checkbox" id="currently_enrolled" name="currently_enrolled" checked={Boolean(v.currently_enrolled)} onChange={handleChange} />
        <label htmlFor="currently_enrolled">I am currently enrolled as a student</label>
      </div>

      <FileDropzone category="certificate" label="Certificates Upload *" hint="At least one certificate or transcript is required" documents={documents} existingDocuments={documents} onUploaded={onDocUploaded} onRemoved={onDocRemoved} />
      <FileDropzone category="transcript" label="Transcript Upload" existingDocuments={documents} onUploaded={onDocUploaded} onRemoved={onDocRemoved} />

      <div className="form-group">
        <label>Professional Certifications (AWS, Cisco, Microsoft, Google, Coursera, Udemy, etc.)</label>
        {(v.certifications || []).map((cert, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 8 }}>
            <input type="text" placeholder="Certification name" value={cert.name || ''} onChange={(e) => handleCertNameChange(idx, 'name', e.target.value)} />
            <input type="text" placeholder="Issuing organization" value={cert.issuing_organization || ''} onChange={(e) => handleCertNameChange(idx, 'issuing_organization', e.target.value)} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeCertification(idx)}>Remove</button>
          </div>
        ))}
        <button type="button" className="btn btn-secondary btn-sm" onClick={addCertification}>+ Add certification</button>
      </div>
    </div>
  );
}
