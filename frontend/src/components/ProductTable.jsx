import { useState } from 'react';

// Shows all products; rows below the reorder threshold are highlighted red.
// Each row has a small form to update qty (simulating a sale/restock),
// which is what triggers the backend's low-stock Kafka publish.
export default function ProductTable({ products, onUpdateQty }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th>Qty</th>
          <th>Reorder At</th>
          <th>Price</th>
          <th>Update Qty</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <ProductRow key={p.id} product={p} onUpdateQty={onUpdateQty} />
        ))}
      </tbody>
    </table>
  );
}

// One table row. Kept as its own component (instead of inline in the
// .map() above) because it needs its own qty state per row.
function ProductRow({ product, onUpdateQty }) {
  const [qty, setQty] = useState(product.qty);
  const isLow = product.qty <= product.reorder_threshold;

  // Runs when this row's form is submitted - stops the page from
  // reloading (preventDefault) and tells the parent the new qty.
  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdateQty(product.id, Number(qty));
  };

  return (
    <tr className={isLow ? 'low-stock' : ''}>
      <td className="product-name">{product.name}</td>
      <td>
        <span className="category-tag">{product.category}</span>
      </td>
      <td>
        {product.qty} {isLow && <span className="badge">LOW</span>}
      </td>
      <td>{product.reorder_threshold}</td>
      <td>${Number(product.price).toFixed(2)}</td>
      <td>
        <form className="qty-form" onSubmit={handleSubmit}>
          <input
            type="number"
            min="0"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button type="submit">Save</button>
        </form>
      </td>
    </tr>
  );
}
