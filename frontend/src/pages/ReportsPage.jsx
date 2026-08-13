import { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';
import BarChartCard from '../components/BarChartCard.jsx';
import { exportToCsv } from '../utils/exportCsv.js';

const ASSET_COLUMNS = [
  { key: 'asset_id', label: 'Asset ID' },
  { key: 'po_number', label: 'PO Number' },
  { key: 'serial_number', label: 'Serial Number' },
  { key: 'asset_type.code', label: 'Type' },
  { key: 'location.location_name', label: 'Location' },
  { key: 'current_owner', label: 'Owner' },
  { key: 'lifecycle_status', label: 'Status' },
];

const COMPLAINT_COLUMNS = [
  { key: 'request_id', label: 'Ticket ID' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'logged_date', label: 'Logged' },
];

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drillDown, setDrillDown] = useState(null);

  useEffect(() => {
    apiFetch('/reports/summary')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const openLocationDrilldown = async (item) => {
    try {
      const assets = await apiFetch(`/assets?location_id=${item.location_id}`);
      setDrillDown({ type: 'asset', label: item.label, rows: assets });
    } catch (err) {
      setError(err.message);
    }
  };

  const openTypeDrilldown = async (item) => {
    try {
      const assets = await apiFetch(`/assets?asset_type_id=${item.asset_type_id}`);
      setDrillDown({ type: 'asset', label: item.label, rows: assets });
    } catch (err) {
      setError(err.message);
    }
  };

  const openPriorityDrilldown = async (item) => {
    try {
      const requests = await apiFetch(`/service-requests?priority=${item.priority}`);
      setDrillDown({ type: 'complaint', label: item.label, rows: requests });
    } catch (err) {
      setError(err.message);
    }
  };

  if (error && !data) return <div className="error-message">{error}</div>;
  if (!data) return <div>Loading report...</div>;

  const assetsByLocationData = data.assetsByLocation.map((item) => ({
    label: item.location_name,
    value: item.count,
    location_id: item.location_id,
  }));
  const assetsByTypeData = data.assetsByType.map((item) => ({
    label: item.asset_type_name || item.asset_type_code,
    value: item.count,
    asset_type_id: item.asset_type_id,
  }));
  const complaintsByPriorityData = data.complaintsByPriority.map((item) => ({
    label: item.priority,
    value: item._count.id,
    priority: item.priority,
  }));

  const exportDrilldown = () => {
    if (!drillDown) return;
    const columns = drillDown.type === 'complaint' ? COMPLAINT_COLUMNS : ASSET_COLUMNS;
    exportToCsv(`${drillDown.type}-${drillDown.label}.csv`, drillDown.rows, columns);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Reports</h1>
      </div>
      {error && <div className="error-message">{error}</div>}

      <div className="chart-row">
        <BarChartCard
          title="Assets by Location"
          data={assetsByLocationData}
          onBarClick={openLocationDrilldown}
          actions={(
            <button
              type="button"
              className="secondary-button"
              onClick={() => exportToCsv('assets-by-location-summary.csv', data.assetsByLocation, [
                { key: 'location_name', label: 'Location' },
                { key: 'count', label: 'Asset Count' },
              ])}
            >
              Download Summary CSV
            </button>
          )}
        />

        <BarChartCard
          title="Assets by Type"
          data={assetsByTypeData}
          onBarClick={openTypeDrilldown}
          actions={(
            <button
              type="button"
              className="secondary-button"
              onClick={() => exportToCsv('assets-by-type-summary.csv', data.assetsByType, [
                { key: 'asset_type_name', label: 'Type' },
                { key: 'count', label: 'Asset Count' },
              ])}
            >
              Download Summary CSV
            </button>
          )}
        />

        <BarChartCard
          title="Complaint Report"
          data={complaintsByPriorityData}
          onBarClick={openPriorityDrilldown}
          actions={(
            <button
              type="button"
              className="secondary-button"
              onClick={() => exportToCsv('complaints-by-priority-summary.csv', data.complaintsByPriority.map((item) => ({ priority: item.priority, count: item._count.id })), [
                { key: 'priority', label: 'Priority' },
                { key: 'count', label: 'Complaint Count' },
              ])}
            >
              Download Summary CSV
            </button>
          )}
        />
      </div>

      {drillDown && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="page-header">
            <h3>{drillDown.label} — {drillDown.rows.length} {drillDown.type === 'complaint' ? 'complaints' : 'assets'}</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="secondary-button" onClick={exportDrilldown}>Export CSV</button>
              <button type="button" className="secondary-button" onClick={() => setDrillDown(null)}>Close</button>
            </div>
          </div>
          <div className="table-card">
            <table>
              <thead>
                <tr>
                  {(drillDown.type === 'complaint' ? COMPLAINT_COLUMNS : ASSET_COLUMNS).map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {drillDown.rows.map((row) => (
                  <tr key={row.id}>
                    {(drillDown.type === 'complaint' ? COMPLAINT_COLUMNS : ASSET_COLUMNS).map((col) => (
                      <td key={col.key}>{col.key.split('.').reduce((acc, part) => acc?.[part], row) ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
