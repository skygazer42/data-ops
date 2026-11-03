import 'reflect-metadata';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Database } from '../src/database/database.js';
import { MonitoringService } from '../src/monitoring/monitoring.service.js';

describe('the project workspace', () => {
  let app: INestApplication;
  let target: Server;
  let targetUrl: string;
  let targetHits = 0;
  const project = { name: 'Test project', description: 'A real project', stack: 'TypeScript', environment: 'production', branch: 'main', repositoryUrl: null, serviceUrl: null, healthUrl: null, monitoringEnabled: true, slowThresholdMs: 800, checkIntervalSeconds: 60 };

  beforeAll(async () => {
    target = createServer((incoming, response) => {
      targetHits += 1;
      const finish = () => {
        if (incoming.url === '/fail') response.statusCode = 503;
        if (incoming.url === '/redirect') { response.statusCode = 302; response.setHeader('Location', `${targetUrl}/ok`); }
        response.end('fixture');
      };
      if (incoming.url === '/slow') setTimeout(finish, 180);
      else if (incoming.url === '/timeout') setTimeout(finish, 1000);
      else finish();
    });
    target.listen(0, '127.0.0.1');
    await once(target, 'listening');
    targetUrl = `http://127.0.0.1:${(target.address() as AddressInfo).port}`;
    app = await createApp({ database: { mode: 'embedded', dataDir: 'memory://', seed: false }, scheduling: false, probeTimeoutMs: 500, webOrigin: 'http://127.0.0.1:5173' });
    await app.init();
  });

  beforeEach(async () => {
    await app.get(Database).query('TRUNCATE projects, health_checks, activity RESTART IDENTITY CASCADE');
    targetHits = 0;
  });

  afterAll(async () => {
    await app?.close();
    target?.closeAllConnections();
    await new Promise<void>((resolve) => target?.close(() => resolve()));
  });

  async function create(overrides: Record<string, unknown> = {}) {
    const response = await request(app.getHttpServer()).post('/api/projects').send({ ...project, ...overrides }).expect(201);
    return response.body as { id: string; name: string };
  }

  it('starts with no invented projects or health metrics', async () => {
    const response = await request(app.getHttpServer()).get('/api/dashboard').expect(200);
    expect(response.body.summary).toMatchObject({ total: 0, healthy: 0, attention: 0, monitored: 0 });
    expect(response.body.trend).toEqual([]);
  });

  it('creates a project and reads its saved configuration', async () => {
    const created = await create({ name: '  Weaver  ' });
    const response = await request(app.getHttpServer()).get(`/api/projects/${created.id}`).expect(200);
    expect(response.body).toMatchObject({ name: 'Weaver', status: 'unconfigured', healthUrl: null, latestCheck: null });
    const events = await request(app.getHttpServer()).get('/api/activity').expect(200);
    expect(events.body[0]).toMatchObject({ kind: 'project_created', projectName: 'Weaver' });
  });

  it('rejects whitespace-only names and credentials in health URLs', async () => {
    await request(app.getHttpServer()).post('/api/projects').send({ ...project, name: '   ' }).expect(400);
    for (const healthUrl of ['file:///etc/passwd', 'https://user:secret@example.com', 'http://169.254.169.254/latest']) {
      await request(app.getHttpServer()).post('/api/projects').send({ ...project, healthUrl }).expect(400);
    }
    const response = await request(app.getHttpServer()).get('/api/projects').expect(200);
    expect(response.body).toHaveLength(0);
  });

  it('returns a useful conflict for duplicate names ignoring case', async () => {
    await create();
    const response = await request(app.getHttpServer()).post('/api/projects').send({ ...project, name: 'test PROJECT' }).expect(409);
    expect(response.body.message).toContain('名称');
  });

  it('updates a project without changing its identity', async () => {
    const created = await create();
    await request(app.getHttpServer()).put(`/api/projects/${created.id}`).send({ ...project, name: 'Renamed', branch: 'release', healthUrl: `${targetUrl}/ok` }).expect(200);
    const response = await request(app.getHttpServer()).get(`/api/projects/${created.id}`).expect(200);
    expect(response.body).toMatchObject({ id: created.id, name: 'Renamed', branch: 'release', status: 'pending' });
  });

  it('records a real successful check and exposes its history', async () => {
    const created = await create({ healthUrl: `${targetUrl}/ok` });
    const checked = await request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).expect(201);
    expect(checked.body).toMatchObject({ status: 'healthy', httpStatus: 200, targetUrl: `${targetUrl}/ok` });
    expect(checked.body.latencyMs).toBeGreaterThanOrEqual(0);
    const response = await request(app.getHttpServer()).get(`/api/projects/${created.id}`).expect(200);
    expect(response.body.status).toBe('healthy');
    const history = await request(app.getHttpServer()).get(`/api/projects/${created.id}/checks`).expect(200);
    expect(history.body).toHaveLength(1);
    const dashboard = await request(app.getHttpServer()).get('/api/dashboard').expect(200);
    expect(dashboard.body.summary).toMatchObject({ healthy: 1, monitored: 1 });
    expect(dashboard.body.trend).toHaveLength(1);
  });

  it('marks slow checks and failing HTTP responses as needing attention', async () => {
    const slow = await create({ name: 'Slow', healthUrl: `${targetUrl}/slow`, slowThresholdMs: 100 });
    const failed = await create({ name: 'Failed', healthUrl: `${targetUrl}/fail` });
    const slowResponse = await request(app.getHttpServer()).post(`/api/projects/${slow.id}/check`).expect(201);
    expect(slowResponse.body.status).toBe('slow');
    const failedResponse = await request(app.getHttpServer()).post(`/api/projects/${failed.id}/check`).expect(201);
    expect(failedResponse.body).toMatchObject({ status: 'down', httpStatus: 503 });
  });

  it('records timeouts and refused connections without leaking internal errors', async () => {
    const timed = await create({ name: 'Timeout', healthUrl: `${targetUrl}/timeout` });
    const offline = await create({ name: 'Offline', healthUrl: 'http://127.0.0.1:1/health' });
    const timedResponse = await request(app.getHttpServer()).post(`/api/projects/${timed.id}/check`).expect(201);
    expect(timedResponse.body).toMatchObject({ status: 'down', error: '检查超时（500 ms）' });
    const offlineResponse = await request(app.getHttpServer()).post(`/api/projects/${offline.id}/check`).expect(201);
    expect(offlineResponse.body).toMatchObject({ status: 'down', httpStatus: null, error: '无法连接到检查地址' });
  });

  it('does not follow redirects', async () => {
    const created = await create({ healthUrl: `${targetUrl}/redirect` });
    const response = await request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).expect(201);
    expect(response.body).toMatchObject({ status: 'healthy', httpStatus: 302 });
    expect(targetHits).toBe(1);
  });

  it('deduplicates simultaneous checks of one project', async () => {
    const created = await create({ healthUrl: `${targetUrl}/slow` });
    const responses = await Promise.all([1, 2, 3].map(() => request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).expect(201)));
    expect(new Set(responses.map((response) => response.body.id)).size).toBe(1);
    expect(targetHits).toBe(1);
  });

  it('invalidates current health after changing the endpoint and preserves history', async () => {
    const created = await create({ healthUrl: `${targetUrl}/ok` });
    await request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).expect(201);
    await request(app.getHttpServer()).put(`/api/projects/${created.id}`).send({ ...project, healthUrl: `${targetUrl}/fail` }).expect(200);
    const response = await request(app.getHttpServer()).get(`/api/projects/${created.id}`).expect(200);
    expect(response.body).toMatchObject({ status: 'pending', latestCheck: null });
    const history = await request(app.getHttpServer()).get(`/api/projects/${created.id}/checks`).expect(200);
    expect(history.body[0].targetUrl).toBe(`${targetUrl}/ok`);
  });

  it('deletes check history while retaining the project deletion activity', async () => {
    const created = await create({ healthUrl: `${targetUrl}/ok` });
    await request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).expect(201);
    await request(app.getHttpServer()).delete(`/api/projects/${created.id}`).expect(204);
    await request(app.getHttpServer()).get(`/api/projects/${created.id}`).expect(404);
    const checks = await app.get(Database).query('SELECT id FROM health_checks');
    expect(checks).toHaveLength(0);
    const events = await request(app.getHttpServer()).get('/api/activity').expect(200);
    expect(events.body[0]).toMatchObject({ kind: 'project_deleted', projectName: project.name, projectId: null });
  });

  it('archives a check against its original configuration when edited in flight', async () => {
    const created = await create({ healthUrl: `${targetUrl}/slow` });
    const started = once(target, 'request');
    const checking = request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).then((response) => response);
    await started;
    await request(app.getHttpServer()).put(`/api/projects/${created.id}`).send({ ...project, healthUrl: `${targetUrl}/fail` }).expect(200);
    expect((await checking).status).toBe(201);
    const current = await request(app.getHttpServer()).get(`/api/projects/${created.id}`).expect(200);
    expect(current.body).toMatchObject({ status: 'pending', latestCheck: null });
    const history = await request(app.getHttpServer()).get(`/api/projects/${created.id}/checks`).expect(200);
    expect(history.body[0].targetUrl).toBe(`${targetUrl}/slow`);
  });

  it('checks the current endpoint when the previous configuration is still in flight', async () => {
    const created = await create({ healthUrl: `${targetUrl}/slow` });
    const started = once(target, 'request');
    const previous = request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).then((response) => response);
    await started;
    await request(app.getHttpServer()).put(`/api/projects/${created.id}`).send({ ...project, healthUrl: `${targetUrl}/fail` }).expect(200);
    const current = await request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).expect(201);
    await previous;
    expect(current.body).toMatchObject({ targetUrl: `${targetUrl}/fail`, status: 'down', httpStatus: 503 });
    expect(targetHits).toBe(2);
  });

  it('can monitor an HTTP service on port 6000', async () => {
    const service = createServer((_incoming, response) => response.end('healthy'));
    service.listen(6000, '127.0.0.1');
    await once(service, 'listening');
    try {
      const created = await create({ healthUrl: 'http://127.0.0.1:6000/health' });
      const response = await request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).expect(201);
      expect(response.body).toMatchObject({ status: 'healthy', httpStatus: 200 });
    } finally {
      service.closeAllConnections();
      await new Promise<void>((resolve) => service.close(() => resolve()));
    }
  });

  it('drains a scheduled batch and stops launching probes before closing the database', async () => {
    const closingApp = await createApp({ database: { mode: 'embedded', dataDir: 'memory://', seed: false }, scheduling: false, probeTimeoutMs: 500, webOrigin: 'http://127.0.0.1:5173' });
    await closingApp.init();
    for (let index = 0; index < 5; index += 1) {
      await request(closingApp.getHttpServer()).post('/api/projects').send({ ...project, name: `Shutdown ${index}`, healthUrl: `${targetUrl}/slow` }).expect(201);
    }
    const started = new Promise<void>((resolve) => {
      let requests = 0;
      const observe = () => { requests += 1; if (requests === 4) { target.off('request', observe); resolve(); } };
      target.on('request', observe);
    });
    const round = closingApp.get(MonitoringService).poll();
    await started;
    const outcomes = await Promise.allSettled([round, closingApp.close()]);
    expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(targetHits).toBe(4);
  });

  it('does not recreate a project or its checks after deletion during a probe', async () => {
    const created = await create({ healthUrl: `${targetUrl}/slow` });
    const started = once(target, 'request');
    const checking = request(app.getHttpServer()).post(`/api/projects/${created.id}/check`).then((response) => response);
    await started;
    await request(app.getHttpServer()).delete(`/api/projects/${created.id}`).expect(204);
    expect((await checking).status).toBe(404);
    expect(await app.get(Database).query('SELECT id FROM health_checks')).toHaveLength(0);
  });

  it('schedules only configured enabled projects when their interval is due', async () => {
    await create({ name: 'Enabled', healthUrl: `${targetUrl}/ok` });
    await create({ name: 'Paused', healthUrl: `${targetUrl}/ok`, monitoringEnabled: false });
    await create({ name: 'Unconfigured' });
    await app.get(MonitoringService).poll();
    expect(targetHits).toBe(1);
    await app.get(MonitoringService).poll();
    expect(targetHits).toBe(1);
    expect(await app.get(Database).query('SELECT id FROM health_checks')).toHaveLength(1);
  });

  it('rejects malformed IDs and writes from untrusted browser origins', async () => {
    await request(app.getHttpServer()).get('/api/projects/not-a-uuid').expect(400);
    await request(app.getHttpServer()).post('/api/projects').set('Origin', 'https://untrusted.example').send(project).expect(403);
  });
});
