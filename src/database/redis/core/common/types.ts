import { Schema } from '../schema/schema';

export type RedisRepoRegisterOptions = {
  schemas: Schema[];
  prefix?: string;
};
