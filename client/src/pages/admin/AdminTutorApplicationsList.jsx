import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Star } from 'lucide-react';
import api, { getErrorMessage } from '../../utils/api';
import { STATUS_LABELS, STATUS_BADGE, SKILL_CATEGORIES } from '../../constants/tutorApplication';

const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

export default function AdminTutorApplicationsList() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = { page };
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category = categoryFilter;

    api.get('/admin/tutor-applications', { params })
      .then((r) => {
        setApplications(r.data.applications || []);
        setTotalPages(r.data.totalPages || 1);
        setTotal(r.data.total || 0);
      })
      .catch((err) => setAlert({ type: 'alert-error', msg: getErrorMessage(err) }))
      .finally(() => setLoading(false));
  }, [page, statusFilter, categoryFilter]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Tutor Applications</h1>
          <p style={{ marginTop: 4 }}>{total} application{total === 1 ? '' : 's'}</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}>
            <option value="">All categories</option>
            {SKILL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      </div>

      {alert && <div className={`alert ${alert.type}`}>{alert.msg}</div>}

      {loading ? (
        <p>Loading…</p>
      ) : applications.length === 0 ? (
        <div className="empty">
          <div className="icon-badge icon-badge-neutral icon-badge-lg" style={{ margin: '0 auto 16px' }}><ClipboardList aria-hidden="true" /></div>
          <h3>No applications found</h3>
          <p>Try adjusting the filters above.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Featured</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app._id}>
                  <td>
                    <div className="tutor-row">
                      <span className="tutor-avatar">{(app.user_id?.email || '?')[0].toUpperCase()}</span>
                      <div>
                        <div>{app.personal_info?.display_name || app.personal_info?.full_name || '—'}</div>
                        <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{app.user_id?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[app.status] || 'badge-neutral'}`}>{STATUS_LABELS[app.status] || app.status}</span></td>
                  <td>{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}</td>
                  <td>{app.featured && <Star width={16} height={16} strokeWidth={1.75} color="var(--orange)" fill="var(--orange)" aria-label="Featured" />}</td>
                  <td><Link to={`/admin/tutor-applications/${app._id}`} className="btn btn-secondary btn-sm">Review</Link></td>
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
