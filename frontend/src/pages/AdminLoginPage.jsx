import { useState } from 'react';
import { apiFetch, saveAuth } from '../api.js';

export default function AdminLoginPage({ onLogin, onSwitchToUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, portal: 'admin' }),
      });
      saveAuth(payload.token, payload.user);
      if (payload.syncResult) {
        localStorage.setItem('upso1_sync_result', JSON.stringify(payload.syncResult));
      } else {
        localStorage.removeItem('upso1_sync_result');
      }
      if (payload.syncError) {
        localStorage.setItem('upso1_sync_error', payload.syncError);
      } else {
        localStorage.removeItem('upso1_sync_error');
      }
      onLogin(payload.user);
    } catch (err) {
      setError(err.message || 'Login failed. Check credentials and backend.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-main" style={{ padding: '3rem 1.5rem' }}>
      <div className="login-shell">
        <div className="login-panel">
          <div className="login-logo">IO</div>
          <div className="login-copy">
            <h2>Admin Login</h2>
            <p>Sign in to manage inventory, track complaints, and keep the plant running smoothly.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" disabled={loading}>
              {loading ? 'Signing in & Syncing Excel...' : 'Sign in securely'}
            </button>
          </form>
          <p style={{ marginTop: '1rem' }}>
            <button type="button" className="secondary-button" onClick={onSwitchToUser}>Employee? Use User Login</button>
          </p>
        </div>
      </div>
    </div>
  );
}
