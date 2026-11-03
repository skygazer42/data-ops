import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
if (existsSync('.env')) process.loadEnvFile('.env');
const compiler = resolve(root, 'node_modules/typescript/bin/tsc');
const built = spawnSync(process.execPath, [compiler, '-p', 'packages/shared/tsconfig.json'], { stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);

const api = spawn(process.execPath, [resolve(root, 'node_modules/tsx/dist/cli.mjs'), 'watch', 'src/main.ts'], {
  cwd: resolve(root, 'apps/api'), stdio: 'inherit', env: { ...process.env, DATABASE_MODE: process.env.DATABASE_MODE ?? 'embedded', DATA_DIR: resolve(root, process.env.DATA_DIR ?? '.data/pro-ops') },
});
const web = spawn(process.execPath, [resolve(root, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: resolve(root, 'apps/web'), stdio: 'inherit' });

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of [api, web]) {
    if (process.platform === 'win32' && child.pid) spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
  process.exit(code);
}
for (const child of [api, web]) {
  child.once('error', (error) => { console.error(error); stop(1); });
  child.once('exit', (code) => stop(code ?? 1));
}
process.once('SIGINT', () => stop());
process.once('SIGTERM', () => stop());
