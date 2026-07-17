import FileDropzone from '../../../components/FileDropzone';
import { EMPLOYMENT_STATUSES } from '../../../constants/tutorApplication';

export default function ExperienceStep({ value, onChange, documents, onDocUploaded, onDocRemoved }) {
  const v = value || {};
  const links = v.portfolio_links || {};

  function handleChange(e) {
    const { name, value: val } = e.target;
    onChange({ [name]: val });
  }

  function handleLinkChange(e) {
    const { name, value: val } = e.target;
    onChange({ portfolio_links: { ...links, [name]: val } });
  }

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Professional Experience</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Employment Status</label>
          <select name="employment_status" value={v.employment_status || ''} onChange={handleChange}>
            <option value="">Select…</option>
            {EMPLOYMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Job Title</label>
          <input type="text" name="current_title" value={v.current_title || ''} onChange={handleChange} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Current Company</label>
          <input type="text" name="current_company" value={v.current_company || ''} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Years Worked</label>
          <input type="number" name="years_of_professional_experience" value={v.years_of_professional_experience || ''} onChange={handleChange} min="0" />
        </div>
      </div>

      <FileDropzone category="resume" label="Resume Upload" existingDocuments={documents} onUploaded={(doc) => { onDocUploaded(doc); onChange({ resume_document_id: doc._id }); }} onRemoved={onDocRemoved} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Portfolio Website / Personal Website</label>
          <input type="text" name="website" value={links.website || ''} onChange={handleLinkChange} placeholder="https://" />
        </div>
        <div className="form-group">
          <label>GitHub</label>
          <input type="text" name="github" value={links.github || ''} onChange={handleLinkChange} placeholder="https://github.com/…" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>LinkedIn</label>
          <input type="text" name="linkedin" value={links.linkedin || ''} onChange={handleLinkChange} placeholder="https://linkedin.com/in/…" />
        </div>
        <div className="form-group">
          <label>Behance</label>
          <input type="text" name="behance" value={links.behance || ''} onChange={handleLinkChange} placeholder="https://behance.net/…" />
        </div>
        <div className="form-group">
          <label>Dribbble</label>
          <input type="text" name="dribbble" value={links.dribbble || ''} onChange={handleLinkChange} placeholder="https://dribbble.com/…" />
        </div>
      </div>

      <FileDropzone category="portfolio_sample" label="Upload Portfolio Files" existingDocuments={documents} onUploaded={onDocUploaded} onRemoved={onDocRemoved} />
    </div>
  );
}
