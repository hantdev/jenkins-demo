const express = require('express');

function createApp() {
  const app = express();

  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/', (req, res) => {
    res.status(200).json({ message: 'Hello from jenkins-demo-app' });
  });

  app.get('/api/v1/echo', (req, res) => {
    const message = req.query.message || 'empty';
    res.status(200).json({ echo: message });
  });

  app.post('/api/v1/sum', express.json(), (req, res) => {
    const { numbers } = req.body || {};
    if (!Array.isArray(numbers)) {
      return res.status(400).json({ error: 'numbers must be an array' });
    }
    const invalid = numbers.some(n => typeof n !== 'number' || Number.isNaN(n));
    if (invalid) {
      return res.status(400).json({ error: 'numbers must contain only numeric values' });
    }
    const total = numbers.reduce((acc, n) => acc + n, 0);
    return res.status(200).json({ total });
  });

  return app;
}

module.exports = { createApp };


