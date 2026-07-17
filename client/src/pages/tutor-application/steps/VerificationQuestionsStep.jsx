export default function VerificationQuestionsStep({ value, onChange }) {
  const v = value || {};
  const philosophyLength = (v.teaching_philosophy || '').length;

  function handleChange(e) {
    const { name, value: val } = e.target;
    onChange({ [name]: val });
  }

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Verification Questions</h2>

      <div className="form-group">
        <label>Why do you want to teach? *</label>
        <textarea name="why_teach" value={v.why_teach || ''} onChange={handleChange} rows={3} required />
      </div>

      <div className="form-group">
        <label>Describe your teaching philosophy. * (minimum 150 characters)</label>
        <textarea name="teaching_philosophy" value={v.teaching_philosophy || ''} onChange={handleChange} rows={4} required />
        <span style={{ fontSize: '.8125rem', color: philosophyLength >= 150 ? 'var(--success)' : 'var(--muted)' }}>
          {philosophyLength} / 150 characters
        </span>
      </div>

      <div className="form-group">
        <label>How do you help beginners? *</label>
        <textarea name="how_help_beginners" value={v.how_help_beginners || ''} onChange={handleChange} rows={3} required />
      </div>

      <div className="form-group">
        <label>How will you keep students engaged? *</label>
        <textarea name="keep_students_engaged" value={v.keep_students_engaged || ''} onChange={handleChange} rows={3} required />
      </div>

      <div className="form-group">
        <label>What makes you different from other tutors? *</label>
        <textarea name="what_makes_different" value={v.what_makes_different || ''} onChange={handleChange} rows={3} required />
      </div>
    </div>
  );
}
