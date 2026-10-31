// Tiny fetch wrapper - same base-URL + JSON pattern we used in class.
const BASE = '/api';

// Every other function in this file calls this one instead of fetch()
// directly, so the JSON headers, error handling, and 204-has-no-body
// check only have to be written once.
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

// One short function per backend endpoint - this is the only file the
// rest of the frontend needs to import from to talk to the API.
export const getProducts = () => request('/products');
export const updateProductQty = (id, qty) =>
  request(`/products/${id}`, { method: 'PUT', body: JSON.stringify({ qty }) });
export const getAlerts = () => request('/alerts');
export const askAgent = (question) =>
  request('/agent/ask', { method: 'POST', body: JSON.stringify({ question }) });
