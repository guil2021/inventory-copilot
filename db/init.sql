-- Inventory Copilot schema
-- Two tables: products (current stock) and alerts (low-stock events logged by the Kafka consumer)

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  qty INT NOT NULL DEFAULT 0,
  reorder_threshold INT NOT NULL DEFAULT 10,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  product_name VARCHAR(100) NOT NULL,
  qty_at_alert INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data so the dashboard has something to show immediately
INSERT INTO products (name, category, qty, reorder_threshold, price) VALUES
  ('Wireless Mouse', 'Electronics', 42, 15, 19.99),
  ('USB-C Cable 1m', 'Electronics', 8, 20, 7.49),
  ('Mechanical Keyboard', 'Electronics', 25, 10, 59.99),
  ('Office Chair', 'Furniture', 5, 8, 129.00),
  ('Standing Desk', 'Furniture', 12, 5, 249.00),
  ('Notebook Pack (3)', 'Office Supplies', 60, 25, 4.99),
  ('Stapler', 'Office Supplies', 9, 15, 6.25),
  ('LED Desk Lamp', 'Electronics', 30, 10, 22.50);
