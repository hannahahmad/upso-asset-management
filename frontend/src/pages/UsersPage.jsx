import { useEffect, useState } from 'react';
import { apiFetch, getStoredUser } from '../api.js';

const ROLES = ['Administrator', 'AssetManager', 'LocationCoordinator', 'Engineer', 'User'];
const emptyForm = { name: '', email: '', password: '', role: 'Engineer', location_id: '' };

export default function UsersPage() {
  const currentUser = getStoredUser();
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    apiFetch('/users')
      .then(setUsers)
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  useEffect(() => {
    apiFetch('/locations').then(setLocations).catch(() => {});
  }, []);

  const handleCreateChange = (field) => (event) => {
    setCreateForm({ ...createForm, [field]: event.target.value });
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...createForm, location_id: createForm.location_id ? Number(createForm.location_id) : undefined };
      await apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) });
      setCreateForm(emptyForm);
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = (user) => {
    setEditingId(user.id);
    setEditForm({ name: user.name, email: user.email, password: '', role: user.role, location_id: user.location?.id ?? '' });
    setError('');
  };

  const handleEditChange = (field) => (event) => {
    setEditForm({ ...editForm, [field]: event.target.value });
  };

  const handleEditSave = async (event, id) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...editForm, location_id: editForm.location_id ? Number(editForm.location_id) : null };
      if (!payload.password) delete payload.password;
      await apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setEditingId(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Delete user ${user.name}? This cannot be undone.`)) return;
    setError('');
    try {
      await apiFetch(`/users/${user.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <button type="button" className="secondary-button" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : 'Add User'}
        </button>
      </div>
      {error && <div className="error-message">{error}</div>}

      {showCreate && (
        <form className="form-block" onSubmit={handleCreate} style={{ marginBottom: '1.2rem' }}>
          <div className="form-row">
            <label>Name</label>
            <input value={createForm.name} onChange={handleCreateChange('name')} required />
          </div>
          <div className="form-row">
            <label>Email</label>
            <input type="email" value={createForm.email} onChange={handleCreateChange('email')} required />
          </div>
          <div className="form-row">
            <label>Password</label>
            <input type="password" value={createForm.password} onChange={handleCreateChange('password')} required />
          </div>
          <div className="form-row">
            <label>Role</label>
            <select value={createForm.role} onChange={handleCreateChange('role')}>
              {ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label>Location</label>
            <select value={createForm.location_id} onChange={handleCreateChange('location_id')}>
              <option value="">None</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.location_name}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Create User'}</button>
        </form>
      )}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Location</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              editingId === user.id ? (
                <tr key={user.id}>
                  <td colSpan={6}>
                    <form onSubmit={(e) => handleEditSave(e, user.id)} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', padding: '0.5rem 0' }}>
                      <input style={{ width: 'auto' }} value={editForm.name} onChange={handleEditChange('name')} required />
                      <input style={{ width: 'auto' }} type="email" value={editForm.email} onChange={handleEditChange('email')} required />
                      <input style={{ width: 'auto' }} type="password" placeholder="New password (optional)" value={editForm.password} onChange={handleEditChange('password')} />
                      <select style={{ width: 'auto' }} value={editForm.role} onChange={handleEditChange('role')}>
                        {ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      <select style={{ width: 'auto' }} value={editForm.location_id} onChange={handleEditChange('location_id')}>
                        <option value="">None</option>
                        {locations.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                        ))}
                      </select>
                      <button type="submit" disabled={saving}>Save</button>
                      <button type="button" className="secondary-button" onClick={() => setEditingId(null)}>Cancel</button>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.location?.name ?? '—'}</td>
                  <td>{user.source === 'import' ? 'Imported' : 'Manual'}</td>
                  <td style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" className="secondary-button" onClick={() => startEditing(user)}>Edit</button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => handleDelete(user)}
                      disabled={user.source === 'import' || user.id === currentUser?.id}
                      title={user.id === currentUser?.id ? 'You cannot delete your own account.' : (user.source === 'import' ? 'Legacy imported users cannot be deleted.' : '')}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
