import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api.js';

const emptyFilters = { location: '', category: '', priority: '', status: '', search: '' };
const STATUS_OPTIONS = ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed'];

export default function ServiceRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [commentDrafts, setCommentDrafts] = useState({});

  useEffect(() => {
    apiFetch('/service-requests')
      .then(setRequests)
      .catch((err) => setError(err.message));
  }, []);

  const updateRequest = async (requestId, payload) => {
    setError('');
    try {
      const updated = await apiFetch(`/service-requests/${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setRequests((prev) => prev.map((req) => (req.id === requestId ? { ...req, ...updated } : req)));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = (request) => (event) => {
    const status = event.target.value;
    setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status } : r)));
    updateRequest(request.id, { status });
  };

  const handleCommentInput = (requestId) => (event) => {
    setCommentDrafts((prev) => ({ ...prev, [requestId]: event.target.value }));
  };

  const commitCommentChange = (request) => (event) => {
    const resolution = event.target.value.trim();
    setCommentDrafts((prev) => {
      const next = { ...prev };
      delete next[request.id];
      return next;
    });
    if (resolution === (request.resolution || '')) return;
    setRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, resolution } : r)));
    updateRequest(request.id, { resolution });
  };

  const uniqueValues = useMemo(() => {
    const locations = new Set();
    const categories = new Set();
    const priorities = new Set();
    const statuses = new Set();
    requests.forEach((request) => {
      if (request.location?.location_name) locations.add(request.location.location_name);
      if (request.category) categories.add(request.category);
      if (request.priority) priorities.add(request.priority);
      if (request.status) statuses.add(request.status);
    });
    const sort = (set) => Array.from(set).sort((a, b) => a.localeCompare(b));
    return {
      locations: sort(locations),
      categories: sort(categories),
      priorities: sort(priorities),
      statuses: sort(statuses),
    };
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return requests.filter((request) => {
      if (filters.location && request.location?.location_name !== filters.location) return false;
      if (filters.category && request.category !== filters.category) return false;
      if (filters.priority && request.priority !== filters.priority) return false;
      if (filters.status && request.status !== filters.status) return false;
      if (search) {
        const haystack = [request.request_id, request.title, request.description, request.reported_by, request.resolution]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [requests, filters]);

  const handleFilterChange = (field) => (event) => {
    setFilters({ ...filters, [field]: event.target.value });
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div>
      <div className="page-header">
        <h1>Complaint Log</h1>
        <Link className="secondary-button" to="/service-requests/new">Create Complaint</Link>
      </div>
      {error && <div className="error-message">{error}</div>}

      <div className="filter-bar">
        <div className="filter-field filter-search">
          <label>Search</label>
          <input
            type="text"
            placeholder="Request ID, title, description, reported by..."
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
          <label>Category</label>
          <select value={filters.category} onChange={handleFilterChange('category')}>
            <option value="">All categories</option>
            {uniqueValues.categories.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label>Priority</label>
          <select value={filters.priority} onChange={handleFilterChange('priority')}>
            <option value="">All priorities</option>
            {uniqueValues.priorities.map((value) => (
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
        Showing {filteredRequests.length} of {requests.length} complaints
      </div>

      <div className="table-card complaints-table-card">
        <table className="complaints-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Logged</th>
              <th>Serial Number</th>
              <th>Asset Location</th>
              <th>User</th>
              <th>Comments / Remarks</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((request) => (
              <tr key={request.id}>
                <td>
                  <Link to={`/service-requests/${request.id}`}>{request.request_id}</Link>
                </td>
                <td>{new Date(request.logged_date).toLocaleDateString()}</td>
                <td>{request.asset?.serial_number || '—'}</td>
                <td>{request.asset?.location?.location_name || '—'}</td>
                <td>{request.submittedBy?.name || request.reported_by || '—'}</td>
                <td>
                  <input
                    type="text"
                    placeholder="Add comments..."
                    value={commentDrafts[request.id] ?? request.resolution ?? ''}
                    onChange={handleCommentInput(request.id)}
                    onBlur={commitCommentChange(request)}
                  />
                </td>
                <td>
                  <select value={request.status ?? 'New'} onChange={handleStatusChange(request)}>
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
