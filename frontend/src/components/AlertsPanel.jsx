// Lists the alerts that the Kafka consumer service has written to MySQL.
// Polled every few seconds so new alerts show up without a page refresh.
export default function AlertsPanel({ alerts }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Low-Stock Alerts</h3>
        <span className="card-sub">via Kafka</span>
      </div>
      {alerts.length === 0 && <p className="empty-state">No alerts yet.</p>}
      {alerts.map((a) => (
        <div key={a.id} className="alert-row">
          <span className="alert-icon" aria-hidden="true">!</span>
          <div>
            <strong>{a.product_name}</strong> dropped to {a.qty_at_alert} units
            <span className="alert-time">
              {new Date(a.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
