import { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [showSyncStatus, setShowSyncStatus] = useState(true);

  useEffect(() => {
    apiFetch('/dashboard')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="error-message">{error}</div>;
  if (!data) return <div>Loading dashboard...</div>;

  const syncResultRaw = localStorage.getItem('upso1_sync_result');
  const syncError = localStorage.getItem('upso1_sync_error');
  const syncResult = syncResultRaw ? JSON.parse(syncResultRaw) : null;

  const maxValue = Math.max(
    data.assetsByLocation.reduce((sum, item) => Math.max(sum, item._count.id), 0),
    data.complaints.reduce((sum, item) => Math.max(sum, item._count.id), 0),
    1
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>UPSO-1</h1>
          <p style={{ margin: 0, color: 'var(--muted)' }}>Asset Inventory & Service Request Management</p>
        </div>
      </div>

      {showSyncStatus && syncError && (
        <div className="error-message" style={{ margin: '1rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Offline Mode: Excel sync failed ({syncError})</span>
          <button onClick={() => {
            setShowSyncStatus(false);
            localStorage.removeItem('upso1_sync_error');
          }} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontWeight: 'bold', marginLeft: '1rem' }}>X</button>
        </div>
      )}

      {showSyncStatus && syncResult && (
        <div style={{ padding: '1rem', backgroundColor: '#e6fffa', border: '1px solid #319795', borderRadius: '4px', margin: '1rem 0', color: '#234e52', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>
            <strong>Excel Synchronization Complete:</strong> Imported/updated {syncResult.assets.created + syncResult.assets.updated} assets ({syncResult.assets.created} new, {syncResult.assets.updated} updated, {syncResult.assets.skipped} skipped, {syncResult.assets.errors} errors) and {syncResult.serviceRequests.created + syncResult.serviceRequests.updated} tickets ({syncResult.serviceRequests.created} new, {syncResult.serviceRequests.updated} updated, {syncResult.serviceRequests.skipped} skipped, {syncResult.serviceRequests.errors} errors).
          </span>
          <button onClick={() => {
            setShowSyncStatus(false);
            localStorage.removeItem('upso1_sync_result');
          }} style={{ background: 'none', border: 'none', color: '#234e52', cursor: 'pointer', fontWeight: 'bold', marginLeft: '1rem' }}>X</button>
        </div>
      )}

      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-title">
            <span>Total Assets</span>
            <span className="status-pill">Live</span>
          </div>
          <div className="metric-value">{data.totalAssets}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">
            <span>AMC Contracts</span>
            <span className="status-pill status-warning">Active</span>
          </div>
          <div className="metric-value">{data.amcCount}</div>
        </div>
        <div className="metric-card">
          <div className="metric-title">
            <span>FMS Tickets</span>
            <span className="status-pill status-info">Tracking</span>
          </div>
          <div className="metric-value">{data.fmsCount}</div>
        </div>
      </div>

      <div className="chart-row" style={{ marginTop: '1.4rem' }}>
        <div className="chart-card">
          <h3>Assets by Location</h3>
          <div className="chart-bar-group">
            {data.assetsByLocation.slice(0, 6).map((item) => (
              <div className="chart-bar" key={item.location_id}>
                <div className="chart-bar-label">
                  <span>{item.location_name || `Location ${item.location_id}`}</span>
                  <span>{item._count.id}</span>
                </div>
                <div className="chart-bar-track">
                  <div
                    className="chart-bar-fill"
                    style={{ width: `${Math.max(8, (item._count.id / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Complaints by Status</h3>
          <div className="chart-bar-group">
            {data.complaints.map((item) => (
              <div className="chart-bar" key={item.status}>
                <div className="chart-bar-label">
                  <span>{item.status}</span>
                  <span>{item._count.id}</span>
                </div>
                <div className="chart-bar-track">
                  <div
                    className="chart-bar-fill"
                    style={{ width: `${Math.max(10, (item._count.id / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-grid" style={{ marginTop: '1.4rem' }}>
        <div className="chart-card">
          <h3>Assets by Type</h3>
          <div className="chart-bar-group">
            {data.assetsByType.map((item) => (
              <div className="chart-bar" key={item.asset_type_id}>
                <div className="chart-bar-label">
                  <span>{item.asset_type_name || item.asset_type_code || `Type ${item.asset_type_id}`}</span>
                  <span>{item._count.id}</span>
                </div>
                <div className="chart-bar-track">
                  <div
                    className="chart-bar-fill"
                    style={{ width: `${Math.max(10, (item._count.id / maxValue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3>Recent Top Locations</h3>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', color: '#d1d5db' }}>
            {data.assetsByLocation.slice(0, 6).map((item) => (
              <li key={item.location_id} style={{ marginBottom: '0.6rem' }}>
                {item.location_name || `Location ${item.location_id}`} · {item._count.id} assets
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
