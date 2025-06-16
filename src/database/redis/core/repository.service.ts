import { InjectRedis } from '@nestjs-modules/ioredis';
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Repository } from './repository';

@Injectable()
export class RepositoryService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  createRepository(schema: any, prefix: string): Repository {
    return new Repository(schema, this.redis, prefix);
  }

  getRedisConnection(): Redis {
    return this.redis;
  }
}
