import { Global, Module, type DynamicModule } from '@nestjs/common';
import { Database, DATABASE_OPTIONS, type DatabaseOptions } from './database.js';

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseOptions): DynamicModule {
    return { module: DatabaseModule, providers: [{ provide: DATABASE_OPTIONS, useValue: options }, Database], exports: [Database] };
  }
}
