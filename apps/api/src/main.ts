import { resolve } from 'node:path';
import { createApp } from './app.js';

const mode = process.env.DATABASE_MODE;
if (mode !== 'embedded' && mode !== 'postgres') throw new Error('Set DATABASE_MODE to embedded (local development) or postgres');
if (process.env.NODE_ENV === 'production' && mode !== 'postgres') throw new Error('Production requires DATABASE_MODE=postgres');

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number');
const app = await createApp({
  database: { mode, dataDir: resolve(process.env.DATA_DIR ?? '.data/pro-ops'), connectionString: process.env.DATABASE_URL, seed: process.env.SEED_PROJECTS !== 'false' },
  scheduling: true, probeTimeoutMs: 5000, webOrigin: process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5173',
});
app.enableShutdownHooks();
await app.listen(port, process.env.HOST ?? '127.0.0.1');
console.log(`Pro Ops API ready at http://${process.env.HOST ?? '127.0.0.1'}:${port}/api/health (${mode})`);
