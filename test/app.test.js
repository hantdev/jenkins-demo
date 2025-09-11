const request = require('supertest');
const { createApp } = require('../src/app');

describe('jenkins-demo-app', () => {
  const app = createApp();

  it('GET /healthz returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET / returns hello message', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Hello from jenkins-demo-app' });
  });
});


