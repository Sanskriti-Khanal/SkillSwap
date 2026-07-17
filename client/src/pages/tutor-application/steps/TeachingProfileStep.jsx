import { SKILL_CATEGORIES, TEACHING_LEVELS, TEACHING_MODES, CURRENCIES, WEEKDAYS } from '../../../constants/tutorApplication';

export default function TeachingProfileStep({ value, onChange }) {
  const v = value || {};
  const bioLength = (v.bio || '').length;
  const availability = v.availability || [];

  function handleChange(e) {
    const { name, value: val } = e.target;
    onChange({ [name]: val });
  }

  function handleSubSkills(e) {
    onChange({ sub_skills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) });
  }

  function handleLanguages(e) {
    onChange({ teaching_languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) });
  }

  function toggleLevel(level) {
    const levels = v.teaching_level || [];
    onChange({ teaching_level: levels.includes(level) ? levels.filter((l) => l !== level) : [...levels, level] });
  }

  function dayBlock(day) {
    return availability.find((a) => a.day === day);
  }

  function toggleDay(day) {
    if (dayBlock(day)) {
      onChange({ availability: availability.filter((a) => a.day !== day) });
    } else {
      onChange({ availability: [...availability, { day, start_time: '09:00', end_time: '17:00' }] });
    }
  }

  function updateDayTime(day, field, val) {
    onChange({ availability: availability.map((a) => (a.day === day ? { ...a, [field]: val } : a)) });
  }

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Teaching Profile</h2>

      <div className="form-group">
        <label>Professional Headline *</label>
        <input type="text" name="professional_headline" value={v.professional_headline || ''} onChange={handleChange} placeholder="Senior React Developer with 6 Years Experience" required />
      </div>

      <div className="form-group">
        <label>Professional Bio * (minimum 200 characters)</label>
        <textarea name="bio" value={v.bio || ''} onChange={handleChange} rows={5} required />
        <span style={{ fontSize: '.8125rem', color: bioLength >= 200 ? 'var(--success)' : 'var(--muted)' }}>
          {bioLength} / 200 characters
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Primary Skill Category *</label>
          <select name="primary_category" value={v.primary_category || ''} onChange={handleChange} required>
            <option value="">Select…</option>
            {SKILL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Years of Industry Experience</label>
          <input type="number" name="teaching_experience_years" value={v.teaching_experience_years || ''} onChange={handleChange} min="0" />
        </div>
      </div>

      <div className="form-group">
        <label>Sub Skills * (comma separated)</label>
        <input type="text" value={(v.sub_skills || []).join(', ')} onChange={handleSubSkills} placeholder="React, Next.js, Node.js" required />
      </div>

      <div className="form-group">
        <label>Teaching Level</label>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {TEACHING_LEVELS.map((level) => (
            <label key={level} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500, fontSize: '.9375rem', textTransform: 'capitalize' }}>
              <input type="checkbox" checked={(v.teaching_level || []).includes(level)} onChange={() => toggleLevel(level)} style={{ accentColor: 'var(--orange)' }} />
              {level}
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Teaching Languages (comma separated)</label>
        <input type="text" value={(v.teaching_languages || []).join(', ')} onChange={handleLanguages} placeholder="English, Nepali" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Teaching Mode</label>
          <select name="teaching_mode" value={v.teaching_mode || ''} onChange={handleChange}>
            <option value="">Select…</option>
            {TEACHING_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Teaching Location</label>
          <input type="text" name="teaching_location" value={v.teaching_location || ''} onChange={handleChange} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        <div className="form-group">
          <label>Hourly Rate</label>
          <input type="number" name="hourly_rate" value={v.hourly_rate || ''} onChange={handleChange} min="0" />
        </div>
        <div className="form-group">
          <label>Currency</label>
          <select name="currency" value={v.currency || 'NPR'} onChange={handleChange}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Maximum Students</label>
          <input type="number" name="max_students" value={v.max_students || ''} onChange={handleChange} min="1" />
        </div>
      </div>

      <div className="form-group">
        <label>Timezone</label>
        <input type="text" name="timezone" value={v.timezone || ''} onChange={handleChange} placeholder="Asia/Kathmandu" />
      </div>

      <div className="form-group">
        <label>Weekly Availability</label>
        {WEEKDAYS.map((day) => {
          const block = dayBlock(day);
          return (
            <div key={day} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                <input type="checkbox" checked={Boolean(block)} onChange={() => toggleDay(day)} style={{ accentColor: 'var(--orange)' }} />
                {day}
              </label>
              <input type="time" disabled={!block} value={block?.start_time || '09:00'} onChange={(e) => updateDayTime(day, 'start_time', e.target.value)} />
              <input type="time" disabled={!block} value={block?.end_time || '17:00'} onChange={(e) => updateDayTime(day, 'end_time', e.target.value)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
