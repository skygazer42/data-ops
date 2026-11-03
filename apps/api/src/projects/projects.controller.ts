import { Body, Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { projectInputSchema, type ProjectInput } from '@pro-ops/shared';
import { ValidationPipe } from '../common/validation.pipe.js';
import { ProjectsService } from './projects.service.js';

@Controller('projects')
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}

  @Get()
  list() { return this.projects.list(); }

  @Post()
  create(@Body(new ValidationPipe(projectInputSchema)) input: ProjectInput) { return this.projects.create(input); }

  @Get(':id')
  find(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.projects.find(id); }

  @Put(':id')
  update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body(new ValidationPipe(projectInputSchema)) input: ProjectInput) { return this.projects.update(id, input); }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.projects.remove(id); }

  @Get(':id/checks')
  checks(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) { return this.projects.checks(id); }
}
