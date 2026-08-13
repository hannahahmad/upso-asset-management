import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api.js';

export default function AssetCreatePage() {
  const navigate = useNavigate();
  const [assetTypes, setAssetTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    asset_id: '',
    serial_number: '',
    asset_type_id: '',
    location_id: '',
    make: '',
    model: '',
    support_type: 'AMC',
    lifecycle_status: 'InStock',
    current_owner: '',
    owner_user_id: '',
    po_number: '',
    po_quantity: '',
    description: '',
  });

  useEffect(() => {
    apiFetch('/asset-types').then(setAssetTypes).catch((err) => setError(err.message));
    apiFetch('/locations').then(setLocations).catch((err) => setError(err.message));
    apiFetch('/users?role=User').then(setUserOptions).catch(() => {});
  }, []);

  const handleChange = (field) => (event) => {
    setForm({ ...form, [field]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      await apiFetch('/assets', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          asset_type_id: Number(form.asset_type_id),
          location_id: Number(form.location_id),
          po_quantity: form.po_quantity ? Number(form.po_quantity) : null,
        }),
      });
      navigate('/assets');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Add New Asset</h1>
        <Link className="secondary-button" to="/assets">Cancel</Link>
      </div>
      {error && <div className="error-message">{error}</div>}
      <form className="form-block" onSubmit={handleSubmit}>
        <div className="form-row">
          <label>Asset ID (optional)</label>
          <input value={form.asset_id} onChange={handleChange('asset_id')} placeholder="Leave blank to auto-generate from PO number" />
        </div>
        <div className="form-row">
          <label>Serial Number</label>
          <input value={form.serial_number} onChange={handleChange('serial_number')} required />
        </div>
        <div className="form-row">
          <label>Asset Type</label>
          <select value={form.asset_type_id} onChange={handleChange('asset_type_id')} required>
            <option value="">Select type</option>
            {assetTypes.map((type) => (
              <option key={type.id} value={type.id}>{type.code}</option>
            ))}
          </select>
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
          <label>Make</label>
          <input value={form.make} onChange={handleChange('make')} />
        </div>
        <div className="form-row">
          <label>Model</label>
          <input value={form.model} onChange={handleChange('model')} />
        </div>
        <div className="form-row">
          <label>Support Type</label>
          <select value={form.support_type} onChange={handleChange('support_type')}>
            <option value="AMC">AMC</option>
            <option value="FMS">FMS</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="form-row">
          <label>Lifecycle Status</label>
          <select value={form.lifecycle_status} onChange={handleChange('lifecycle_status')}>
            <option value="InStock">In Stock</option>
            <option value="InUse">In Use</option>
            <option value="Buyback">Buyback</option>
            <option value="Disposed">Disposed</option>
          </select>
        </div>
        <div className="form-row">
          <label>Current Owner</label>
          <input value={form.current_owner} onChange={handleChange('current_owner')} />
        </div>
        <div className="form-row">
          <label>Assigned User</label>
          <select value={form.owner_user_id} onChange={handleChange('owner_user_id')}>
            <option value="">Unassigned</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
        <div className="form-row">
          <label>PO Number</label>
          <input value={form.po_number} onChange={handleChange('po_number')} placeholder="Asset ID auto-generates from this" />
        </div>
        <div className="form-row">
          <label>PO Quantity</label>
          <input type="number" min="1" step="1" value={form.po_quantity} onChange={handleChange('po_quantity')} placeholder="Positive whole number" />
        </div>
        <div className="form-row">
          <label>Description</label>
          <textarea value={form.description} onChange={handleChange('description')} rows="4" />
        </div>
        <button type="submit">Create Asset</button>
      </form>
    </div>
  );
}
