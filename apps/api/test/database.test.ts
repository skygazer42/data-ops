import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Logger, type INestApplication } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('database lifecycle', () => {
  it('handles background PostgreSQL connection errors without an uncaught event', async () => {
    const pool = Object.assign(new EventEmitter(), { query: vi.fn().mockResolvedValue({ rows: [] }), end: vi.fn().mockResolvedValue(undefined) });
    const construct = vi.spyOn(pg, 'Pool').mockImplementation(function () { return pool as unknown as pg.Pool; });
    const logging = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    let running: INestApplication | undefined;
    try {
      running = await createApp({ database: { mode: 'postgres', connectionString: 'postgresql://fixture', seed: false }, scheduling: false, probeTimeoutMs: 500, webOrigin: 'http://127.0.0.1:5173' });
      await running.init();
      expect(() => pool.emit('error', new Error('fixture connection lost'))).not.toThrow();
      expect(logging).toHaveBeenCalled();
    } finally {
      await running?.close();
      construct.mockRestore();
      logging.mockRestore();
    }
  });

  it('preserves projects, checks and activities after reopening an on-disk workspace', async () => {
    const dataDir = await mkdtemp(join(tmpdir(), 'pro-ops-persistence-'));
    let running: INestApplication | undefined;
    const options = { database: { mode: 'embedded' as const, dataDir, seed: true }, scheduling: false, probeTimeoutMs: 500, webOrigin: 'http://127.0.0.1:5173' };
    try {
      running = await createApp(options);
      await running.init();
      const initial = await request(running.getHttpServer()).get('/api/projects').expect(200);
      const removed = initial.body.find((project: { name: string }) => project.name === 'MimirQ');
      await request(running.getHttpServer()).delete(`/api/projects/${removed.id}`).expect(204);
      const created = await request(running.getHttpServer()).post('/api/projects').send({ name: 'Persisted workspace', branch: 'release', healthUrl: 'http://127.0.0.1:1/health' }).expect(201);
      const checked = await request(running.getHttpServer()).post(`/api/projects/${created.body.id}/check`).expect(201);
      await running.close();
      running = undefined;

      running = await createApp(options);
      await running.init();
      const restored = await request(running.getHttpServer()).get(`/api/projects/${created.body.id}`).expect(200);
      expect(restored.body).toMatchObject({ name: 'Persisted workspace', branch: 'release', status: 'down', latestCheck: { id: checked.body.id } });
      const checks = await request(running.getHttpServer()).get(`/api/projects/${created.body.id}/checks`).expect(200);
      expect(checks.body).toHaveLength(1);
      const activity = await request(running.getHttpServer()).get('/api/activity').expect(200);
      expect(activity.body).toEqual(expect.arrayContaining([expect.objectContaining({ projectName: 'Persisted workspace', kind: 'project_created' })]));
      await request(running.getHttpServer()).get(`/api/projects/${removed.id}`).expect(404);
      const projects = await request(running.getHttpServer()).get('/api/projects').expect(200);
      expect(projects.body).toHaveLength(6);
    } finally {
      await running?.close();
      expect(dirname(dataDir)).toBe(resolve(tmpdir()));
      await rm(dataDir, { recursive: true });
    }
  }, 45000);
});
