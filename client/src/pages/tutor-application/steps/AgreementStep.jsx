export default function AgreementStep({ value, onChange }) {
  const v = value || {};

  function handleCheckbox(e) {
    onChange({ [e.target.name]: e.target.checked });
  }

  function handleSignature(e) {
    onChange({ signature_name: e.target.value });
  }

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>Agreements</h2>

      <div className="checkbox-row">
        <input type="checkbox" id="info_accurate" name="info_accurate" checked={Boolean(v.info_accurate)} onChange={handleCheckbox} />
        <label htmlFor="info_accurate">I certify all information is accurate.</label>
      </div>
      <div className="checkbox-row">
        <input type="checkbox" id="false_info_understood" name="false_info_understood" checked={Boolean(v.false_info_understood)} onChange={handleCheckbox} />
        <label htmlFor="false_info_understood">I understand false information may permanently suspend my account.</label>
      </div>
      <div className="checkbox-row">
        <input type="checkbox" id="terms_accepted" name="terms_accepted" checked={Boolean(v.terms_accepted)} onChange={handleCheckbox} />
        <label htmlFor="terms_accepted">I agree to the Tutor Terms &amp; Conditions.</label>
      </div>
      <div className="checkbox-row">
        <input type="checkbox" id="privacy_policy_accepted" name="privacy_policy_accepted" checked={Boolean(v.privacy_policy_accepted)} onChange={handleCheckbox} />
        <label htmlFor="privacy_policy_accepted">I agree to the Privacy Policy.</label>
      </div>

      <div className="divider" />

      <div className="form-group">
        <label>Digital Signature — type your full legal name *</label>
        <input type="text" value={v.signature_name || ''} onChange={handleSignature} placeholder="Your full name" required />
      </div>
      <p style={{ fontSize: '.8125rem' }}>
        Signature date will be recorded automatically when you submit.
      </p>
    </div>
  );
}
