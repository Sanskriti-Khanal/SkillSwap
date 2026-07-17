import { Clock } from 'lucide-react';

export default function ComingSoon({ feature }) {
  return (
    <div className="empty">
      <div className="icon-badge icon-badge-neutral icon-badge-lg" style={{ margin: '0 auto 16px' }}><Clock aria-hidden="true" /></div>
      <h3>{feature} — Coming Soon</h3>
      <p>This section is on our roadmap and isn't available yet.</p>
    </div>
  );
}
