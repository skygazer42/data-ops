import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { initialSchema, seedProjects } from './schema.js';

export const DATABASE_OPTIONS = Symbol('DATABASE_OPTIONS');

export interface DatabaseOptions {
  mode: 'embedded' | 'postgres';
  dataDir?: string;
  connectionString?: string;
  seed: boolean;
}

export interface QueryExecutor {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<Row[]>;
}

@Injectable()
export class Database implements OnModuleInit, OnApplicationShutdown, QueryExecutor {
  private readonly logger = new Logger(Database.name);
  private embedded?: PGlite;
  private pool?: pg.Pool;

  constructor(@Inject(DATABASE_OPTIONS) private readonly options: DatabaseOptions) {}

  async onModuleInit() {
    if (this.options.mode === 'embedded') {
      const dataDir = this.options.dataDir ?? 'memory://';
      if (dataDir !== 'memory://') await mkdir(dataDir, { recursive: true });
      this.embedded = new PGlite(dataDir);
      await this.embedded.waitReady;
      await this.embedded.exec(initialSchema);
    } else {
      if (!this.options.connectionString) throw new Error('DATABASE_URL is required in postgres mode');
      this.pool = new pg.Pool({ connectionString: this.options.connectionString, max: 5, connectionTimeoutMillis: 5000 });
      this.pool.on('error', (error: Error) => this.logger.error('PostgreSQL background connection failed', error.message));
      await this.pool.query(initialSchema);
    }
    if (this.options.seed) await this.seed();
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<Row[]> {
    if (this.embedded) return (await this.embedded.query<Row>(sql, params)).rows;
    if (this.pool) return (await this.pool.query<Row>(sql, params)).rows;
    throw new Error('Database has not been initialized');
  }

  async transaction<Result>(work: (executor: QueryExecutor) => Promise<Result>): Promise<Result> {
    if (this.embedded) {
      return this.embedded.transaction((client) => work({ query: async <Row extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await client.query<Row>(sql, params)).rows }));
    }
    if (!this.pool) throw new Error('Database has not been initialized');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work({ query: async <Row extends Record<string, unknown>>(sql: string, params: unknown[] = []) => (await client.query<Row>(sql, params)).rows });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async seed() {
    await this.transaction(async (executor) => {
      const existing = await executor.query('SELECT version FROM schema_migrations WHERE version = 2');
      if (existing.length) return;
      for (const [name, description, stack] of seedProjects) {
        await executor.query(`INSERT INTO projects(id, name, description, stack, environment, repository_url, slow_threshold_ms, check_interval_seconds)
          VALUES ($1, $2, $3, $4, 'production', $5, 800, 60) ON CONFLICT DO NOTHING`, [randomUUID(), name, description, stack, `https://github.com/skygazer42/${name}`]);
      }
      await executor.query('INSERT INTO schema_migrations(version) VALUES (2)');
    });
  }

  async onApplicationShutdown() {
    await this.embedded?.close();
    await this.pool?.end();
  }
}
