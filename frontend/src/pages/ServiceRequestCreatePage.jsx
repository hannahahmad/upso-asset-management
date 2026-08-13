import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';

export default function ServiceRequestCreatePage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    request_id: '',
    location_id: '',
    category: '',
    priority: 'Low',
    title: '',
    description: '',
    asset_id: '',
    reported_by: '',
  });

  useEffect(() => {
    apiFetch('/locations').then(setLocations).catch((err) => setError(err.message));
    apiFetch('/assets').then(setAssets).catch((err) => setError(err.message));
  }, []);

  const handleChange = (field) => (event) => {
    setForm({ ...form, [field]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await apiFetch('/service-requests', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          location_id: Number(form.location_id),
          asset_id: form.asset_id ? Number(form.asset_id) : undefined,
        }),
      });
      navigate('/service-requests');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Create Complaint</h1>
        <Link className="secondary-button" to="/service-requests">Cancel</Link>
      </div>
      {error && <div className="error-message">{error}</div>}
      <form className="form-block" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Request ID (optional)</label>
          <input value={form.request_id} onChange={handleChange('request_id')} placeholder="Leave blank to auto-generate" />
        </div>
        <div className="form-row">
          <label>Location</label>
          <select value={form.location_id} onChange={handleChange('location_id')} required>
            <option value="">Select location</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.location_name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Asset</label>
          <select value={form.asset_id} onChange={handleChange('asset_id')}>
            <option value="">None</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.asset_id} - {asset.serial_number}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>Category</label>
          <input value={form.category} onChange={handleChange('category')} required />
        </div>
        <div className="form-row">
          <label>Priority</label>
          <select value={form.priority} onChange={handleChange('priority')}>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>
        <div className="form-row">
          <label>Title</label>
          <input value={form.title} onChange={handleChange('title')} required />
        </div>
        <div className="form-row">
          <label>Description</label>
          <textarea value={form.description} onChange={handleChange('description')} rows="4" />
        </div>
        <div className="form-row">
          <label>Reported by</label>
          <input value={form.reported_by} onChange={handleChange('reported_by')} />
        </div>
        <button type="submit">Create Complaint</button>
      </form>
    </div>
  );
}
