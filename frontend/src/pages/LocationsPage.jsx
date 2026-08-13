import { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

const emptyForm = { location_name: '', location_code: '', region: '', accountable_contact: '' };

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch('/locations')
      .then(setLocations)
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const handleCreateChange = (field) => (event) => {
    setCreateForm({ ...createForm, [field]: event.target.value });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/locations', { method: 'POST', body: JSON.stringify(createForm) });
      setCreateForm(emptyForm);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (loc) => {
    if (!window.confirm(`Delete location ${loc.location_name}? This cannot be undone.`)) return;
    setError('');
    try {
      await apiFetch(`/locations/${loc.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Location Details</h1>
        <button type="button" className="secondary-button" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Add Location'}
        </button>
      </div>
      {error && <div className="error-message">{error}</div>}

      {showCreate && (
        <form className="form-block" onSubmit={handleCreate} style={{ marginBottom: '1.2rem' }}>
          <div className="form-row">
            <label>Location Name</label>
            <input value={createForm.location_name} onChange={handleCreateChange('location_name')} required />
          </div>
          <div className="form-row">
            <label>Location Code</label>
            <input value={createForm.location_code} onChange={handleCreateChange('location_code')} required />
          </div>
          <div className="form-row">
            <label>Region</label>
            <input value={createForm.region} onChange={handleCreateChange('region')} />
          </div>
          <div className="form-row">
            <label>Accountable Contact</label>
            <input value={createForm.accountable_contact} onChange={handleCreateChange('accountable_contact')} />
          </div>
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create Location'}</button>
        </form>
      )}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Code</th>
              <th>Assets</th>
              <th>Open complaints</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id}>
                <td>{loc.location_name}</td>
                <td>{loc.location_code}</td>
                <td>{loc.asset_count}</td>
                <td>{loc.open_complaint_count}</td>
                <td>{loc.source === 'import' ? 'Imported' : 'Manual'}</td>
                <td>
                  <button type="button" className="secondary-button" onClick={() => handleDelete(loc)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
