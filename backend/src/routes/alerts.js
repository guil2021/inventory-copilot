// GET /api/alerts - the frontend polls this to show the alerts panel.
// Rows here are written by the separate Kafka consumer service, not by
// this backend, which is the point: producer and consumer are decoupled.
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM alerts ORDER BY created_at DESC LIMIT 20'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
