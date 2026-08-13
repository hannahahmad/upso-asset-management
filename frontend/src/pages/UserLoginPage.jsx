import { useState } from 'react';
import { apiFetch, saveAuth } from '../api.js';

export default function UserLoginPage({ onLogin, onSwitchToAdmin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const payload = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, portal: 'user' }),
      });
      saveAuth(payload.token, payload.user);
      onLogin(payload.user);
    } catch (err) {
      setError(err.message || 'Login failed. Check credentials and backend.');
    }
  };

  return (
    <div className="content-main" style={{ padding: '3rem 1.5rem' }}>
      <div className="login-shell">
        <div className="login-panel">
          <div className="login-logo">IO</div>
          <div className="login-copy">
            <h2>User Login</h2>
            <p>Sign in to view your allotted assets and raise or track complaints.</p>
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
            <button type="submit">Sign in</button>
          </form>
          <p style={{ marginTop: '1rem' }}>
            <button type="button" className="secondary-button" onClick={onSwitchToAdmin}>Administrator? Use Admin Login</button>
          </p>
        </div>
      </div>
    </div>
  );
}
