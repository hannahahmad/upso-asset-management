export default function BarChartCard({ title, data, emptyLabel = 'No data for the current filters.', onBarClick, actions }) {
  const maxValue = data.reduce((max, item) => Math.max(max, item.value), 1);
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="chart-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{title}</h3>
        {actions}
      </div>
      {sorted.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>{emptyLabel}</p>
      ) : (
        <div className="chart-bar-group">
          {sorted.map((item) => (
            <div
              className="chart-bar"
              key={item.label}
              onClick={onBarClick ? () => onBarClick(item) : undefined}
              style={onBarClick ? { cursor: 'pointer' } : undefined}
            >
              <div className="chart-bar-label">
                <span>{item.label}</span>
                <span>{item.value}</span>
              </div>
              <div className="chart-bar-track">
                <div
                  className="chart-bar-fill"
                  style={{ width: `${Math.max(4, (item.value / maxValue) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
