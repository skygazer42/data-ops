import { Controller, Get, Inject, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Database } from '../database/database.js';
import { ProjectsService } from '../projects/projects.service.js';
import { MonitoringService } from './monitoring.service.js';

@Controller()
export class MonitoringController {
  constructor(
    @Inject(MonitoringService) private readonly monitoring: MonitoringService,
    @Inject(ProjectsService) private readonly projects: ProjectsService,
    @Inject(Database) private readonly database: Database,
  ) {}

  @Get('health')
  async health() {
    await this.database.query('SELECT 1');
    return { status: 'ok', service: 'pro-ops', time: new Date().toISOString() };
  }

  @Get('dashboard')
  dashboard() { return this.monitoring.dashboard(); }

  @Get('activity')
  activity() { return this.projects.activity(); }

  @Post('projects/:id/check')
  check(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.monitoring.check(id); }
}
