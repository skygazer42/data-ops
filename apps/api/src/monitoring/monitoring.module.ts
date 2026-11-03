import { Module, type DynamicModule } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module.js';
import { MonitoringController } from './monitoring.controller.js';
import { MonitoringService, MONITORING_OPTIONS, type MonitoringOptions } from './monitoring.service.js';

@Module({})
export class MonitoringModule {
  static forRoot(options: MonitoringOptions): DynamicModule {
    return { module: MonitoringModule, imports: [ProjectsModule], controllers: [MonitoringController],
      providers: [{ provide: MONITORING_OPTIONS, useValue: options }, MonitoringService], exports: [MonitoringService] };
  }
}
