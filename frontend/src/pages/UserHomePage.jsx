import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, getStoredUser } from '../api.js';

export default function UserHomePage() {
  const user = getStoredUser();
  const [assets, setAssets] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/assets?owner_user_id=${user.id}`)
      .then(setAssets)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1>My Assets</h1>
      </div>
      {error && <div className="error-message">{error}</div>}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Asset Name</th>
              <th>Location</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td>{asset.asset_type?.name || asset.asset_type?.code}{asset.model ? ` - ${asset.model}` : ''}</td>
                <td>{asset.location?.location_name}</td>
                <td>
                  <Link className="secondary-button" to={`/complaints/new/${asset.id}`}>Create Complaint</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {assets.length === 0 && !error && (
        <p>No assets are currently allotted to you. Contact your administrator.</p>
      )}
    </div>
  );
}
