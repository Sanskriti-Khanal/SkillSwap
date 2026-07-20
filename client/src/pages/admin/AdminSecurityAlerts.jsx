import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';
import api, { getErrorMessage } from '../../utils/api';

const TYPE_LABELS = {
  repeated_failed_logins: 'Repeated failed logins',
  repeated_access_denied: 'Repeated access denied',
  jwt_reuse: 'JWT reuse',
  refresh_token_reuse: 'Refresh token reuse',
  excessive_password_reset_requests: 'Excessive password reset requests',
  excessive_api_requests: 'Excessive API requests',
  multi_country_access: 'Multiple countries in short period',
};
const TYPE_OPTIONS = Object.keys(TYPE_LABELS);

const SEVERITY_BADGE = { low: 'badge-neutral', medium: 'badge-yellow', high: 'badge-orange', critical: 'badge-red' };
const STATUS_BADGE = { open: 'badge-red', resolved: 'badge-green' };

function formatDetails(alert) {
  const d = alert.details || {};
  switch (alert.type) {
    case 'repeated_failed_logins':
      return `${d.failed_attempts} failed attempts`;
    case 'repeated_access_denied':
      return `${d.count} denials in ${d.windowMinutes}min — last: ${d.method} ${d.path}`;
    case 'jwt_reuse':
      return `Fingerprint mismatch (device/IP changed mid-token)`;
    case 'refresh_token_reuse':
      return `Already-used refresh token replayed`;
    case 'excessive_password_reset_requests':
      return `${d.count} requests in ${d.windowMinutes}min`;
    case 'excessive_api_requests':
      return `${d.requestsInWindow} requests in the last minute`;
    case 'multi_country_access':
      return `Logins from ${d.countries?.join(', ')} within ${d.withinMinutes}min`;
    default:
      return JSON.stringify(d);
  }
}

export default function AdminSecurityAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertMsg, setAlertMsg] = useState(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [resolvingId, setResolvingId] = useState(null);

  const fetchAlerts = useCallback(() => {
    setLoading(true);
    const params = { page };
    if (statusFilter) params.status = statusFilter;
    if (typeFilter) params.type = typeFilter;

    api.get('/admin/security-alerts', { params })
      .then((r) => {
        setAlerts(r.data.alerts || []);
        setTotalPages(r.data.totalPages || 1);
        setTotal(r.data.total || 0);
        setOpenCount(r.data.openCount || 0);
      })
      .catch((err) => setAlertMsg({ type: 'alert-error', msg: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, [page, statusFilter, typeFilter]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleResolve = async (id) => {
    setResolvingId(id);
    try {
      await api.patch(`/admin/security-alerts/${id}/resolve`);
      fetchAlerts();
    } catch (err) {
      setAlertMsg({ type: 'alert-error', msg: getErrorMessage(err) });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Security Alerts</h1>
          <p style={{ marginTop: 4 }}>{openCount} open alert{openCount === 1 ? '' : 's'} &middot; {total} shown</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">All types</option>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>
      </div>

      {alertMsg && <div className={`alert ${alertMsg.type}`}>{alertMsg.msg}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : alerts.length === 0 ? (
        <div className="empty">
          <div className="icon-badge icon-badge-neutral icon-badge-lg" style={{ margin: '0 auto 16px' }}><ShieldAlert aria-hidden="true" /></div>
          <h3>No alerts found</h3>
          <p>Try adjusting the filters above.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Who / Where</th>
                <th>Details</th>
                <th>When</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a._id}>
                  <td>{TYPE_LABELS[a.type] || a.type}</td>
                  <td><span className={`badge ${SEVERITY_BADGE[a.severity] || 'badge-neutral'}`}>{a.severity}</span></td>
                  <td style={{ fontSize: '.8125rem' }}>
                    {a.userId?.email && <div>{a.userId.email}</div>}
                    {a.ip && <div style={{ color: 'var(--muted)' }}>{a.ip}</div>}
                  </td>
                  <td style={{ fontSize: '.8125rem', maxWidth: 320 }}>{formatDetails(a)}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '.8125rem' }}>{new Date(a.createdAt).toLocaleString()}</td>
                  <td><span className={`badge ${STATUS_BADGE[a.status] || 'badge-neutral'}`}>{a.status}</span></td>
                  <td>
                    {a.status === 'open' ? (
                      <button className="btn btn-secondary btn-sm" disabled={resolvingId === a._id} onClick={() => handleResolve(a._id)}>
                        {resolvingId === a._id ? 'Resolving…' : 'Resolve'}
                      </button>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '.8125rem', color: 'var(--muted)' }}>
                        <CheckCircle2 width={14} height={14} strokeWidth={1.75} aria-hidden="true" />
                        {a.resolved_by?.email || 'resolved'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
