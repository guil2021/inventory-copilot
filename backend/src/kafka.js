// Kafka producer - the backend publishes one event here whenever a product
// update drops qty at/below its reorder_threshold. The consumer service
// (consumer/consumer.js) listens for these and writes rows into `alerts`.
const { Kafka } = require('kafkajs');
require('dotenv').config();

const kafka = new Kafka({
  clientId: 'inventory-backend',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: { retries: 5 },
});

const producer = kafka.producer();
let connected = false;

// Connects the producer once and remembers it did, so every call to
// publishLowStockAlert() below doesn't reconnect to Kafka each time.
async function connectProducer() {
  if (!connected) {
    await producer.connect();
    connected = true;
    console.log('Kafka producer connected');
  }
}

// Sends one message to the low-stock-alerts topic for this product. The
// message is JSON text (Kafka only moves bytes/strings) with everything the
// consumer service needs to log the alert on its own.
async function publishLowStockAlert(product) {
  await connectProducer();
  await producer.send({
    topic: process.env.KAFKA_TOPIC || 'low-stock-alerts',
    messages: [
      {
        key: String(product.id),
        value: JSON.stringify({
          productId: product.id,
          productName: product.name,
          qty: product.qty,
          reorderThreshold: product.reorder_threshold,
          timestamp: new Date().toISOString(),
        }),
      },
    ],
  });
  console.log(`Published low-stock alert for "${product.name}" (qty=${product.qty})`);
}

module.exports = { publishLowStockAlert, connectProducer };
