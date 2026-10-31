import { useEffect, useState } from 'react';
import ProductTable from './components/ProductTable.jsx';
import AlertsPanel from './components/AlertsPanel.jsx';
import ChatPanel from './components/ChatPanel.jsx';
import { getProducts, getAlerts, updateProductQty } from './api';

export default function App() {
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');

  // Two small functions that fetch from the backend and push the result
  // into state - called once on load, then again every 4s by the poll below.
  const loadProducts = () => getProducts().then(setProducts).catch((e) => setError(e.message));
  const loadAlerts = () => getAlerts().then(setAlerts).catch(() => {});

  // Runs once when the component mounts: load both lists immediately, then
  // keep refreshing them on a timer so new Kafka alerts show up on their own.
  useEffect(() => {
    loadProducts();
    loadAlerts();
    // Poll every 4s so the alerts panel picks up what the Kafka consumer
    // writes, without needing websockets for a 25-minute demo.
    const interval = setInterval(() => {
      loadProducts();
      loadAlerts();
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Passed down to ProductTable - called when a row's "Save" button is
  // clicked. Sends the new qty to the backend, then reloads the list so
  // the UI reflects whatever the server actually saved.
  const handleUpdateQty = async (id, qty) => {
    try {
      await updateProductQty(id, qty);
      loadProducts();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="app">
      <div className="hero">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">📦</span>
          <h1>Inventory Copilot</h1>
          <span className="live-pill">
            <span className="dot" /> Live
          </span>
        </div>
        <p className="subtitle">
          React + Express + MySQL + Kafka + LangChain/OpenAI multi-agent copilot
        </p>
      </div>

      {error && <p className="error-banner">{error}</p>}

      {/* Three at-a-glance numbers computed from the same `products` list
          already loaded above - no extra API call needed. */}
      <div className="kpi-row">
        <div className="kpi-tile">
          <span className="kpi-icon blue" aria-hidden="true">📦</span>
          <div>
            <p className="kpi-label">Total Products</p>
            <p className="kpi-value">{products.length}</p>
          </div>
        </div>
        <div className="kpi-tile">
          <span className="kpi-icon critical" aria-hidden="true">⚠️</span>
          <div>
            <p className="kpi-label">Low Stock</p>
            <p className="kpi-value">
              {products.filter((p) => p.qty <= p.reorder_threshold).length}
            </p>
          </div>
        </div>
        <div className="kpi-tile">
          <span className="kpi-icon aqua" aria-hidden="true">💰</span>
          <div>
            <p className="kpi-label">Inventory Value</p>
            <p className="kpi-value">
              $
              {products
                .reduce((sum, p) => sum + Number(p.price) * p.qty, 0)
                .toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      <div className="layout">
        <div className="card">
          <div className="card-header">
            <h3>Products</h3>
            <span className="card-sub">{products.length} items</span>
          </div>
          <ProductTable products={products} onUpdateQty={handleUpdateQty} />
        </div>

        <div>
          <AlertsPanel alerts={alerts} />
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}
