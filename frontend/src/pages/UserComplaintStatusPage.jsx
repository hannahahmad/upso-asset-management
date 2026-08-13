import { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

const STATUS_DISPLAY_MAP = { New: 'Open', Resolved: 'Closed' };
const displayStatus = (status) => STATUS_DISPLAY_MAP[status] || status;

export default function UserComplaintStatusPage() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    apiFetch('/service-requests')
      .then(setRequests)
      .catch((err) => setError(err.message));
  }, []);

  const toggleExpand = async (request) => {
    if (expandedId === request.id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(request.id);
    setDetail(null);
    try {
      const full = await apiFetch(`/service-requests/${request.id}`);
      let relatedRequests = [];
      if (full.asset_id) {
        const assetFull = await apiFetch(`/assets/${full.asset_id}`);
        relatedRequests = (assetFull.serviceRequests || []).filter((r) => r.id !== full.id);
      }
      setDetail({ ...full, relatedRequests });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>My Complaints</h1>
      </div>
      {error && <div className="error-message">{error}</div>}

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Asset</th>
              <th>Description</th>
              <th>Date/Time</th>
              <th>Status</th>
              <th>Resolution</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <>
                <tr key={request.id} onClick={() => toggleExpand(request)} style={{ cursor: 'pointer' }}>
                  <td>{request.request_id}</td>
                  <td>{request.asset ? `${request.asset.asset_type?.code || ''} ${request.asset.serial_number}` : '—'}</td>
                  <td>{request.description || request.title}</td>
                  <td>{new Date(request.logged_date).toLocaleString()}</td>
                  <td>{displayStatus(request.status)}</td>
                  <td>{request.resolution || '—'}</td>
                </tr>
                {expandedId === request.id && (
                  <tr>
                    <td colSpan={6}>
                      {!detail ? (
                        <p>Loading...</p>
                      ) : (
                        <div style={{ padding: '0.5rem 0' }}>
                          <h4>History</h4>
                          <ul>
                            {(detail.auditLogs || []).map((log) => (
                              <li key={log.id}>
                                {new Date(log.changed_at).toLocaleString()}: {log.action} {log.field_changed || ''}
                              </li>
                            ))}
                          </ul>
                          {detail.relatedRequests && detail.relatedRequests.length > 0 && (
                            <>
                              <h4>Other complaints for this asset</h4>
                              <ul>
                                {detail.relatedRequests.map((rr) => (
                                  <li key={rr.id}>{rr.request_id} — {displayStatus(rr.status)}</li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      {requests.length === 0 && !error && <p>You haven't raised any complaints yet.</p>}
    </div>
  );
}
