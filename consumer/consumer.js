// Standalone Kafka consumer service. It is deliberately separate from the
// backend process: the backend's job is to answer HTTP requests fast, and
// publish an event when stock gets low; this service's job is to pick that
// event up, whenever it's ready, and persist it. That decoupling is the
// whole point of using Kafka here instead of just writing to the alerts
// table directly inside the PUT /api/products/:id route.
const { Kafka } = require('kafkajs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const kafka = new Kafka({
  clientId: 'inventory-consumer',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: { retries: 8, initialRetryTime: 1000 },
});

const consumer = kafka.consumer({ groupId: 'inventory-alerts-group' });

// The whole program is really just: connect to MySQL, connect to Kafka,
// then sit and wait - eachMessage fires once per event the backend
// publishes, for as long as this process stays running.
async function run() {
  // This service's own connection pool to MySQL - separate from the
  // backend's, since this runs as its own process/container.
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'inventory',
  });

  // Join the topic as a member of "inventory-alerts-group" (set above) and
  // start listening from new messages only (fromBeginning: false).
  await consumer.connect();
  const topic = process.env.KAFKA_TOPIC || 'low-stock-alerts';
  await consumer.subscribe({ topic, fromBeginning: false });
  console.log(`Consumer subscribed to "${topic}", waiting for alerts...`);

  // eachMessage is the handler Kafka calls for every message on the topic.
  // Parse the JSON text back into an object, then insert one row per alert.
  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      console.log('Received low-stock event:', event);

      await pool.query(
        'INSERT INTO alerts (product_id, product_name, qty_at_alert) VALUES (?, ?, ?)',
        [event.productId, event.productName, event.qty]
      );
      console.log(`Logged alert for "${event.productName}" into MySQL`);
    },
  });
}

run().catch((err) => {
  console.error('Consumer crashed:', err);
  process.exit(1);
});
