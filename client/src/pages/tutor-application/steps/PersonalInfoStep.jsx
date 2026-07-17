import FileDropzone from '../../../components/FileDropzone';

export default function PersonalInfoStep({ value, onChange, email, documents, onDocUploaded, onDocRemoved }) {
  const v = value || {};

  function handleChange(e) {
    const { name, value: val } = e.target;
    onChange({ [name]: val });
  }

  function handleLanguages(e) {
    onChange({ languages_spoken: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) });
  }

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Personal Information</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Full Name *</label>
          <input type="text" name="full_name" value={v.full_name || ''} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Display Name *</label>
          <input type="text" name="display_name" value={v.display_name || ''} onChange={handleChange} required />
        </div>
      </div>

      <FileDropzone
        category="profile_photo"
        label="Profile Photo"
        existingDocuments={documents}
        onUploaded={(doc) => { onDocUploaded(doc); onChange({ profile_photo_document_id: doc._id }); }}
        onRemoved={onDocRemoved}
      />
      <FileDropzone
        category="cover_photo"
        label="Cover Photo (optional)"
        existingDocuments={documents}
        onUploaded={(doc) => { onDocUploaded(doc); onChange({ cover_photo_document_id: doc._id }); }}
        onRemoved={onDocRemoved}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Date of Birth</label>
          <input type="date" name="date_of_birth" value={v.date_of_birth ? v.date_of_birth.slice(0, 10) : ''} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>Gender (optional)</label>
          <select name="gender" value={v.gender || ''} onChange={handleChange}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="non_binary">Non-binary</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Email</label>
        <input type="email" value={email || ''} disabled readOnly />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Phone Number *</label>
          <input type="text" name="phone_number" value={v.phone_number || ''} onChange={handleChange} placeholder="+977 98xxxxxxxx" required />
        </div>
        <div className="form-group">
          <label>Nationality *</label>
          <input type="text" name="nationality" value={v.nationality || ''} onChange={handleChange} required />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Country *</label>
          <input type="text" name="country" value={v.country || ''} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label>Province/State</label>
          <input type="text" name="province_state" value={v.province_state || ''} onChange={handleChange} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>District</label>
          <input type="text" name="district" value={v.district || ''} onChange={handleChange} />
        </div>
        <div className="form-group">
          <label>City *</label>
          <input type="text" name="city" value={v.city || ''} onChange={handleChange} required />
        </div>
      </div>

      <div className="form-group">
        <label>Full Address</label>
        <textarea name="full_address" value={v.full_address || ''} onChange={handleChange} rows={2} />
      </div>

      <div className="form-group">
        <label>Languages Spoken * (comma separated)</label>
        <input type="text" value={(v.languages_spoken || []).join(', ')} onChange={handleLanguages} placeholder="English, Nepali" required />
      </div>
    </div>
  );
}
