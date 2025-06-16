import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { RepositoryService } from './repository.service';
import { RedisRepoRegisterOptions } from './common/types';
import { Schema } from './schema/schema';

function getRepoProvides(schemas: Schema[], prefix: string): Provider[] {
  return schemas.map((schema: Schema) => {
    return {
      provide: schema.name,
      useFactory: (repoService: RepositoryService) => {
        return repoService.createRepository(schema, prefix);
      },
      inject: [RepositoryService],
    };
  });
}

@Global()
@Module({
  providers: [RepositoryService],
  exports: [RepositoryService],
})
export class RepositoryModule {
  static register(options: RedisRepoRegisterOptions): DynamicModule {
    const providers = getRepoProvides(options.schemas, options.prefix);
    return {
      module: RepositoryModule,
      providers: providers,
      exports: providers,
    };
  }
}
