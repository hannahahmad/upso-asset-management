import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch, getStoredUser } from '../api.js';

export default function UserComplaintCreatePage() {
  const navigate = useNavigate();
  const { assetId } = useParams();
  const user = getStoredUser();
  const [myAssets, setMyAssets] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    asset_id: assetId || '',
    category: '',
    priority: 'Low',
    title: '',
    description: '',
  });

  useEffect(() => {
    apiFetch(`/assets?owner_user_id=${user.id}`)
      .then(setMyAssets)
      .catch((err) => setError(err.message));
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
          asset_id: Number(form.asset_id),
        }),
      });
      navigate('/complaints');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Create Complaint</h1>
        <Link className="secondary-button" to="/">Cancel</Link>
      </div>
      {error && <div className="error-message">{error}</div>}
      <form className="form-block" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Asset</label>
          <select value={form.asset_id} onChange={handleChange('asset_id')} required>
            <option value="">Select asset</option>
            {myAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.asset_type?.name || asset.asset_type?.code} - {asset.serial_number}
              </option>
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
            <option value="Critical">Critical</option>
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
        <button type="submit">Create Complaint</button>
      </form>
    </div>
  );
}
