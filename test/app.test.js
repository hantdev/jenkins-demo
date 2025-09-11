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

  it('GET /api/v1/echo echoes query message', async () => {
    const res = await request(app).get('/api/v1/echo?message=hi');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ echo: 'hi' });
  });

  it('POST /api/v1/sum sums numbers', async () => {
    const res = await request(app)
      .post('/api/v1/sum')
      .send({ numbers: [1, 2, 3.5] })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 6.5 });
  });

  it('POST /api/v1/sum validates input', async () => {
    const res = await request(app)
      .post('/api/v1/sum')
      .send({ numbers: [1, 'x'] })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'numbers must contain only numeric values' });
  });
});


