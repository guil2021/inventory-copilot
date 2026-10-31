// REST API for products: GET all, GET one, POST create, PUT update qty, DELETE.
// Same CRUD + status code conventions we used in class.
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { publishLowStockAlert } = require('../kafka');

// GET /api/products - list everything, newest update first
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY updated_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/products - create a new product
router.post('/', async (req, res) => {
  const { name, category, qty, reorder_threshold, price } = req.body;
  if (!name || !category) {
    return res.status(400).json({ error: 'name and category are required' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO products (name, category, qty, reorder_threshold, price) VALUES (?, ?, ?, ?, ?)',
      [name, category, qty || 0, reorder_threshold || 10, price || 0]
    );
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/products/:id - update qty (e.g. after a sale or a restock).
// This is the one route that talks to Kafka: if the new qty falls at or
// below the reorder threshold, we publish a low-stock event.
router.put('/:id', async (req, res) => {
  const { qty } = req.body;
  if (qty === undefined) return res.status(400).json({ error: 'qty is required' });

  try {
    const [existing] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Product not found' });

    await pool.query('UPDATE products SET qty = ? WHERE id = ?', [qty, req.params.id]);
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    const updated = rows[0];

    if (updated.qty <= updated.reorder_threshold) {
      // Fire-and-forget: don't block the API response on Kafka
      publishLowStockAlert(updated).catch((e) => console.error('Kafka publish failed:', e.message));
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found' });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
