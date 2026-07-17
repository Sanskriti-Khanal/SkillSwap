import FileDropzone from '../../../components/FileDropzone';

export default function TeachingProofStep({ value, onChange, documents, onDocUploaded, onDocRemoved }) {
  const v = value || {};

  function handleChange(e) {
    const { name, value: val } = e.target;
    onChange({ [name]: val });
  }

  return (
    <div>
      <h2 style={{ marginBottom: 8 }}>Teaching Proof</h2>
      <p style={{ marginBottom: 20, fontSize: '.875rem' }}>
        Provide at least one form of proof that demonstrates your teaching ability or expertise.
      </p>

      <div className="form-group">
        <label>Teaching Demo Video — YouTube Link</label>
        <input type="text" name="demo_video_youtube_url" value={v.demo_video_youtube_url || ''} onChange={handleChange} placeholder="https://youtube.com/watch?v=…" />
      </div>

      <div className="form-group">
        <label>Portfolio URL</label>
        <input type="text" name="portfolio_url" value={v.portfolio_url || ''} onChange={handleChange} placeholder="https://" />
      </div>

      <div className="form-group">
        <label>Student Testimonials</label>
        <textarea name="testimonials" value={v.testimonials || ''} onChange={handleChange} rows={3} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Research Papers URL</label>
          <input type="text" name="research_papers_url" value={v.research_papers_url || ''} onChange={handleChange} placeholder="https://" />
        </div>
        <div className="form-group">
          <label>Articles URL</label>
          <input type="text" name="articles_url" value={v.articles_url || ''} onChange={handleChange} placeholder="https://" />
        </div>
      </div>

      <div className="form-group">
        <label>Previous Teaching Experience</label>
        <textarea name="previous_teaching_experience" value={v.previous_teaching_experience || ''} onChange={handleChange} rows={3} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Projects URL</label>
          <input type="text" name="projects_url" value={v.projects_url || ''} onChange={handleChange} placeholder="https://" />
        </div>
        <div className="form-group">
          <label>GitHub Repository</label>
          <input type="text" name="github_repository_url" value={v.github_repository_url || ''} onChange={handleChange} placeholder="https://github.com/…" />
        </div>
      </div>

      <div className="form-group">
        <label>Case Studies URL</label>
        <input type="text" name="case_studies_url" value={v.case_studies_url || ''} onChange={handleChange} placeholder="https://" />
      </div>

      <FileDropzone category="demo_video" label="Or upload a demo video / proof file" existingDocuments={documents} onUploaded={onDocUploaded} onRemoved={onDocRemoved} />
    </div>
  );
}
