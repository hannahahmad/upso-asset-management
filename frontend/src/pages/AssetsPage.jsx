import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';
import BarChartCard from '../components/BarChartCard.jsx';
import { countBy } from '../utils/countBy.js';

const emptyFilters = { location: '', assetType: '', supportType: '', status: '', search: '' };

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [ownerDrafts, setOwnerDrafts] = useState({});

  useEffect(() => {
    apiFetch('/assets')
      .then(setAssets)
      .catch((err) => setError(err.message));
    apiFetch('/locations')
      .then(setLocationOptions)
      .catch(() => {});
    apiFetch('/users?role=User')
      .then(setUserOptions)
      .catch(() => {});
  }, []);

  const updateAsset = async (assetId, payload) => {
    setError('');
    try {
      const updated = await apiFetch(`/assets/${assetId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      setAssets((prev) => prev.map((asset) => (asset.id === assetId ? { ...asset, ...updated } : asset)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLocationChange = (asset) => (event) => {
    const location_id = Number(event.target.value);
    const location = locationOptions.find((loc) => loc.id === location_id);
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, location_id, location } : a)));
    updateAsset(asset.id, { location_id });
  };

  const handleSupportTypeChange = (asset) => (event) => {
    const support_type = event.target.value;
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, support_type } : a)));
    updateAsset(asset.id, { support_type });
  };

  const handleStatusChange = (asset) => (event) => {
    const lifecycle_status = event.target.value;
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, lifecycle_status } : a)));
    updateAsset(asset.id, { lifecycle_status });
  };

  const handleOwnerUserChange = (asset) => (event) => {
    const owner_user_id = event.target.value ? Number(event.target.value) : null;
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, owner_user_id } : a)));
    updateAsset(asset.id, { owner_user_id });
  };

  const handleOwnerInput = (assetId) => (event) => {
    setOwnerDrafts((prev) => ({ ...prev, [assetId]: event.target.value }));
  };

  const commitOwnerChange = (asset) => (event) => {
    const current_owner = event.target.value.trim();
    setOwnerDrafts((prev) => {
      const next = { ...prev };
      delete next[asset.id];
      return next;
    });
    if (current_owner === (asset.current_owner || '')) return;
    setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, current_owner } : a)));
    updateAsset(asset.id, { current_owner });
  };

  const uniqueValues = useMemo(() => {
    const locations = new Set();
    const assetTypes = new Set();
    const supportTypes = new Set();
    const statuses = new Set();
    assets.forEach((asset) => {
      if (asset.location?.location_name) locations.add(asset.location.location_name);
      if (asset.asset_type?.code) assetTypes.add(asset.asset_type.code);
      if (asset.support_type) supportTypes.add(asset.support_type);
      if (asset.lifecycle_status) statuses.add(asset.lifecycle_status);
    });
    const sort = (set) => Array.from(set).sort((a, b) => a.localeCompare(b));
    return {
      locations: sort(locations),
      assetTypes: sort(assetTypes),
      supportTypes: sort(supportTypes),
      statuses: sort(statuses),
    };
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (filters.location && asset.location?.location_name !== filters.location) return false;
      if (filters.assetType && asset.asset_type?.code !== filters.assetType) return false;
      if (filters.supportType && asset.support_type !== filters.supportType) return false;
      if (filters.status && asset.lifecycle_status !== filters.status) return false;
      if (search) {
        const haystack = [asset.asset_id, asset.po_number, asset.po_quantity, asset.serial_number, asset.current_owner, asset.make, asset.model]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [assets, filters]);

  const handleFilterChange = (field) => (event) => {
    setFilters({ ...filters, [field]: event.target.value });
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const breakdown = useMemo(() => ({
    byLocation: countBy(filteredAssets, (asset) => asset.location?.location_name),
    byType: countBy(filteredAssets, (asset) => asset.asset_type?.code),
    bySupportType: countBy(filteredAssets, (asset) => asset.support_type),
    byStatus: countBy(filteredAssets, (asset) => asset.lifecycle_status),
  }), [filteredAssets]);

  return (
    <div>
      <div className="page-header">
        <h1>Asset Register</h1>
        <Link className="secondary-button" to="/assets/new">Add Asset</Link>
      </div>
      {error && <div className="error-message">{error}</div>}

      <div className="filter-bar">
        <div className="filter-field filter-search">
          <label>Search</label>
          <input
            type="text"
            placeholder="Asset ID, serial, owner, make, model..."
            value={filters.search}
            onChange={handleFilterChange('search')}
          />
        </div>
        <div className="filter-field">
          <label>Location</label>
          <select value={filters.location} onChange={handleFilterChange('location')}>
            <option value="">All locations</option>
            {uniqueValues.locations.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label>Asset Type</label>
          <select value={filters.assetType} onChange={handleFilterChange('assetType')}>
            <option value="">All types</option>
            {uniqueValues.assetTypes.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label>Support Type</label>
          <select value={filters.supportType} onChange={handleFilterChange('supportType')}>
            <option value="">All support types</option>
            {uniqueValues.supportTypes.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label>Status</label>
          <select value={filters.status} onChange={handleFilterChange('status')}>
            <option value="">All statuses</option>
            {uniqueValues.statuses.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button type="button" className="secondary-button filter-clear" onClick={() => setFilters(emptyFilters)}>
            Clear filters
          </button>
        )}
      </div>

      <div className="result-count">
        Showing {filteredAssets.length} of {assets.length} assets
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Asset ID</th>
              <th>PO Number</th>
              <th>PO Quantity</th>
              <th>Serial</th>
              <th>Type</th>
              <th>Location</th>
              <th>Support Type</th>
              <th>Status</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <Link to={`/assets/${asset.id}`}>{asset.asset_id}</Link>
                </td>
                <td>{asset.po_number}</td>
                <td>{asset.po_quantity || '—'}</td>
                <td>{asset.serial_number}</td>
                <td>{asset.asset_type?.code}</td>
                <td>
                  <select value={asset.location_id ?? ''} onChange={handleLocationChange(asset)}>
                    {locationOptions.map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.location_name}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select value={asset.support_type ?? ''} onChange={handleSupportTypeChange(asset)}>
                    <option value="AMC">AMC</option>
                    <option value="FMS">FMS</option>
                  </select>
                </td>
                <td>
                  <select value={asset.lifecycle_status ?? ''} onChange={handleStatusChange(asset)}>
                    <option value="InStock">In Stock</option>
                    <option value="Buyback">Buyback</option>
                    <option value="Dispose">Dispose</option>
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={ownerDrafts[asset.id] ?? asset.current_owner ?? ''}
                    onChange={handleOwnerInput(asset.id)}
                    onBlur={commitOwnerChange(asset)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Visualizations</h2>
      <div className="section-grid">
        <BarChartCard title="Assets by Location" data={breakdown.byLocation} />
        <BarChartCard title="Assets by Type" data={breakdown.byType} />
        <BarChartCard title="Assets by Support Type" data={breakdown.bySupportType} />
        <BarChartCard title="Assets by Status" data={breakdown.byStatus} />
      </div>
    </div>
  );
}
