import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule, type AppOptions } from './app.module.js';

export async function createApp(options: AppOptions) {
  const app = await NestFactory.create(AppModule.forRoot(options), { logger: ['error', 'warn'] });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: options.webOrigin, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'] });
  app.useGlobalGuards({
    canActivate(context) {
      const request = context.switchToHttp().getRequest<{ headers: { origin?: string } }>();
      return !request.headers.origin || request.headers.origin === options.webOrigin;
    },
  });
  return app;
}
