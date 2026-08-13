import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api.js';

const STATUSES = ['New', 'In Progress', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

export default function ServiceRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch(`/service-requests/${id}`)
      .then(setRequest)
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  useEffect(() => {
    apiFetch('/locations').then(setLocations).catch(() => {});
  }, []);

  const startEditing = () => {
    setForm({
      title: request.title ?? '',
      description: request.description ?? '',
      location_id: request.location_id ?? '',
      category: request.category ?? '',
      sub_category: request.sub_category ?? '',
      priority: request.priority ?? '',
      status: request.status ?? '',
      resolution: request.resolution ?? '',
      assigned_engineer: request.assigned_engineer ?? '',
      reported_by: request.reported_by ?? '',
    });
    setEditing(true);
    setError('');
  };

  const handleChange = (field) => (event) => {
    setForm({ ...form, [field]: event.target.value });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, location_id: Number(form.location_id) };
      const updated = await apiFetch(`/service-requests/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setRequest({ ...request, ...updated });
      setEditing(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete complaint ${request.request_id}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/service-requests/${id}`, { method: 'DELETE' });
      navigate('/service-requests');
    } catch (err) {
      setError(err.message);
    }
  };

  if (error && !request) return <div className="error-message">{error}</div>;
  if (!request) return <div>Loading request...</div>;

  const isImported = request.source === 'import';

  return (
    <div>
      <div className="page-header">
        <h1>Complaint Detail</h1>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {!editing && (
            <button type="button" className="secondary-button" onClick={startEditing}>Edit</button>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={handleDelete}
            disabled={isImported}
            title={isImported ? 'Legacy imported service requests cannot be deleted.' : ''}
          >
            Delete
          </button>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}

      {editing ? (
        <form className="form-block" onSubmit={handleSave}>
          <div className="form-row">
            <label>Title</label>
            <input value={form.title} onChange={handleChange('title')} required />
          </div>
          <div className="form-row">
            <label>Location</label>
            <select value={form.location_id} onChange={handleChange('location_id')} required>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.location_name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Category</label>
            <input value={form.category} onChange={handleChange('category')} required />
          </div>
          <div className="form-row">
            <label>Sub Category</label>
            <input value={form.sub_category} onChange={handleChange('sub_category')} />
          </div>
          <div className="form-row">
            <label>Priority</label>
            <select value={form.priority} onChange={handleChange('priority')}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Status</label>
            <select value={form.status} onChange={handleChange('status')}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Resolution</label>
            <textarea value={form.resolution} onChange={handleChange('resolution')} rows="3" />
          </div>
          <div className="form-row">
            <label>Assigned Engineer</label>
            <input value={form.assigned_engineer} onChange={handleChange('assigned_engineer')} />
          </div>
          <div className="form-row">
            <label>Reported By</label>
            <input value={form.reported_by} onChange={handleChange('reported_by')} />
          </div>
          <div className="form-row">
            <label>Description</label>
            <textarea value={form.description} onChange={handleChange('description')} rows="4" />
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
            <button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <div className="card-grid">
            <div className="card">
              <h3>{request.title}</h3>
              <p><strong>Request ID:</strong> {request.request_id}</p>
              <p><strong>Status:</strong> {request.status}</p>
              <p><strong>Resolution:</strong> {request.resolution || '—'}</p>
              <p><strong>Category:</strong> {request.category}</p>
              <p><strong>Priority:</strong> {request.priority}</p>
              <p><strong>Logged:</strong> {new Date(request.logged_date).toLocaleString()}</p>
              <p><strong>Source:</strong> {isImported ? 'Imported (legacy)' : 'Manually added'}</p>
            </div>
            <div className="card">
              <h3>Location</h3>
              <p>{request.location?.location_name}</p>
              <p><strong>Sub location:</strong> {request.sub_location}</p>
              <p><strong>User:</strong> {request.submittedBy?.name || request.reported_by || '—'}</p>
              <p><strong>Assigned engineer:</strong> {request.assigned_engineer}</p>
            </div>
          </div>
          <div className="card">
            <h3>Description</h3>
            <p>{request.description || 'No description provided.'}</p>
          </div>
        </>
      )}
    </div>
  );
}
