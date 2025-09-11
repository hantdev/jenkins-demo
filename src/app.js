const express = require('express');

function createApp() {
  const app = express();

  app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/', (req, res) => {
    res.status(200).json({ message: 'Hello from jenkins-demo-app' });
  });

  return app;
}

module.exports = { createApp };


