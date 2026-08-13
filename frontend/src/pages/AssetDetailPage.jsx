import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../api.js';

const FIELDS = ['asset_id', 'serial_number', 'asset_type_id', 'location_id', 'make', 'model', 'support_type', 'lifecycle_status', 'current_owner', 'owner_user_id', 'po_number', 'po_quantity', 'description'];

export default function AssetDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [asset, setAsset] = useState(null);
  const [assetTypes, setAssetTypes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch(`/assets/${id}`)
      .then(setAsset)
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  useEffect(() => {
    apiFetch('/asset-types').then(setAssetTypes).catch(() => {});
    apiFetch('/locations').then(setLocations).catch(() => {});
    apiFetch('/users?role=User').then(setUserOptions).catch(() => {});
  }, []);

  const startEditing = () => {
    setForm({
      asset_id: asset.asset_id ?? '',
      serial_number: asset.serial_number ?? '',
      asset_type_id: asset.asset_type_id ?? '',
      location_id: asset.location_id ?? '',
      make: asset.make ?? '',
      model: asset.model ?? '',
      support_type: asset.support_type ?? '',
      lifecycle_status: asset.lifecycle_status ?? '',
      current_owner: asset.current_owner ?? '',
      owner_user_id: asset.owner_user_id ?? '',
      po_number: asset.po_number ?? '',
      po_quantity: asset.po_quantity ?? '',
      description: asset.description ?? '',
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
      const payload = {
        ...form,
        asset_type_id: Number(form.asset_type_id),
        location_id: Number(form.location_id),
        owner_user_id: form.owner_user_id ? Number(form.owner_user_id) : null,
        po_quantity: form.po_quantity ? Number(form.po_quantity) : null,
      };
      const updated = await apiFetch(`/assets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setAsset({ ...asset, ...updated });
      setEditing(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete asset ${asset.asset_id}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/assets/${id}`, { method: 'DELETE' });
      navigate('/assets');
    } catch (err) {
      setError(err.message);
    }
  };

  if (error && !asset) return <div className="error-message">{error}</div>;
  if (!asset) return <div>Loading asset...</div>;

  const isImported = asset.source === 'import';

  return (
    <div>
      <div className="page-header">
        <h1>Asset Detail</h1>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {!editing && (
            <button type="button" className="secondary-button" onClick={startEditing}>Edit</button>
          )}
          <button
            type="button"
            className="secondary-button"
            onClick={handleDelete}
            disabled={isImported}
            title={isImported ? 'Legacy imported assets cannot be deleted.' : ''}
          >
            Delete
          </button>
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}

      {editing ? (
        <form className="form-block" onSubmit={handleSave}>
          <div className="form-row">
            <label>Asset ID</label>
            <input value={form.asset_id} onChange={handleChange('asset_id')} required />
          </div>
          <div className="form-row">
            <label>Serial Number</label>
            <input value={form.serial_number} onChange={handleChange('serial_number')} required />
          </div>
          <div className="form-row">
            <label>Asset Type</label>
            <select value={form.asset_type_id} onChange={handleChange('asset_type_id')} required>
              {assetTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.code}</option>
              ))}
            </select>
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
            <input value={form.po_number} onChange={handleChange('po_number')} />
          </div>
          <div className="form-row">
            <label>PO Quantity</label>
            <input type="number" min="1" step="1" value={form.po_quantity} onChange={handleChange('po_quantity')} />
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
              <h3>Identity</h3>
              <p><strong>Asset ID:</strong> {asset.asset_id}</p>
              <p><strong>PO Number:</strong> {asset.po_number || '—'}</p>
              <p><strong>PO Quantity:</strong> {asset.po_quantity || '—'}</p>
              <p><strong>Serial:</strong> {asset.serial_number}</p>
              <p><strong>Type:</strong> {asset.asset_type?.code}</p>
              <p><strong>Make/Model:</strong> {asset.make} {asset.model}</p>
              <p><strong>Source:</strong> {isImported ? 'Imported (legacy)' : 'Manually added'}</p>
            </div>
            <div className="card">
              <h3>Location & Status</h3>
              <p><strong>Location:</strong> {asset.location?.location_name}</p>
              <p><strong>Owner:</strong> {asset.current_owner}</p>
              <p><strong>Assigned User:</strong> {userOptions.find((u) => u.id === asset.owner_user_id)?.name || 'Unassigned'}</p>
              <p><strong>Status:</strong> {asset.lifecycle_status}</p>
              <p><strong>Support:</strong> {asset.support_type}</p>
            </div>
          </div>
          <div className="card">
            <h3>Audit / Related Requests</h3>
            <div className="asset-detail-sections">
              <div>
                <h4>Audit logs</h4>
                <ul>
                  {asset.auditLogs.map((log) => (
                    <li key={log.id}>{new Date(log.changed_at).toLocaleString()}: {log.action} {log.field_changed || ''}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>Service requests</h4>
                <ul>
                  {asset.serviceRequests.map((req) => (
                    <li key={req.id}>{req.request_id} - {req.status}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
