import { Module, type DynamicModule } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import type { DatabaseOptions } from './database/database.js';
import { ProjectsModule } from './projects/projects.module.js';
import { MonitoringModule } from './monitoring/monitoring.module.js';

export interface AppOptions {
  database: DatabaseOptions;
  scheduling: boolean;
  probeTimeoutMs: number;
  webOrigin: string;
}

@Module({})
export class AppModule {
  static forRoot(options: AppOptions): DynamicModule {
    return { module: AppModule, imports: [DatabaseModule.forRoot(options.database), ProjectsModule,
      MonitoringModule.forRoot({ scheduling: options.scheduling, probeTimeoutMs: options.probeTimeoutMs })] };
  }
}
