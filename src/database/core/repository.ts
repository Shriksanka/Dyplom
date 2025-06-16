import { Redis } from 'ioredis';
import { Schema } from './schema/schema';
import { Entity } from './entity';

export class Repository {
  private _schema: Schema;
  private _prefix: string;

  constructor(schema: Schema, private readonly _client: Redis, prefix: string) {
    this._schema = schema;
    this._prefix = prefix ? `${prefix}:` : '';
  }

  async save<T>(entity: T): Promise<Entity>;

  async save<T>(key: string, entity: T): Promise<Entity>;

  async save<T>(key: string, entity: T, buildKey: boolean): Promise<Entity>;

  /**
   * Saves an entity to the Redis database.
   *
   * @template T - The type of the entity.
   * @param {T | string} entityOrKey - The entity to save or the key of the entity.
   * @param {T} [maybeEntity] - The entity to save if the first parameter is a key.
   * @param {boolean} [buildKey=true] - Whether to build the key using the schema prefix.
   * @returns {Promise<Entity>} - A promise that resolves to the saved entity.
   *
   * @throws {Error} - Throws an error if the entity schema validation fails.
   */
  async save<T>(
    entityOrKey: T | string,
    maybeEntity?: T,
    buildKey = true,
  ): Promise<Entity> {
    let entity: (T & Entity) | undefined;
    let entityKey: string | undefined;

    if (typeof entityOrKey !== 'string') {
      entity = entityOrKey;
      entityKey = entity.entityKeyName;
    } else {
      entity = maybeEntity;
      entityKey = entityOrKey;
    }

    let keyName = entityKey
      ? `${this._prefix}${this._schema.name}:${entityKey}`
      : this._schema.name;

    if (!buildKey) {
      keyName = entityKey ? entityKey : this._schema.name;
    }

    const clonedEntity = {
      ...entity,
      entityKeyName: keyName,
    };

    this._schema.validateSchema(clonedEntity);
    await this._client.hmset(keyName, entity);

    return clonedEntity;
  }

  async fetch<T>(key: string, buildKey = true): Promise<T> {
    const _key = buildKey ? this._makeKey(key) : key;

    const data = await this._client.hgetall(_key);

    return Object.entries(data).reduce((acc: any, [key, value]) => {
      return {
        ...acc,
        ...{
          [key]: this._parseJSON(value),
        },
      };
    }, {});
  }

  async fetchAll<T>(key: string): Promise<Map<string, T>> {
    const keys = await this._client.keys(`*${key}*`);
    const resp = new Map();
    if (!keys.length) return resp;

    for (const key of keys) {
      const data = await this.fetch<T>(key, false);
      resp.set(key, data);
    }

    return resp;
  }

  async getKeys(substring: string): Promise<string[]> {
    return this._client.keys(`*${substring}*`);
  }

  getFullKey(key = '') {
    return key
      ? `${this._prefix}${this._schema.name}:${key}`
      : `${this._prefix}${this._schema.name}`;
  }

  /**
   * Sets an expiration time on a given key.
   *
   * @param key - The key to set the expiration time on.
   * @param ttl - The time-to-live (TTL) in seconds.
   * @returns A promise that resolves to the result of the expiration command.
   */
  async expireAt(key: string, ttl: number) {
    return this._client.expire(this._makeKey(key), ttl);
  }

  async delete(key = ''): Promise<number | null> {
    const keys = await this._client.keys(`*${this._makeKey(key)}*`);
    if (!keys.length) return null;
    return this._client.del(keys);
  }

  private _makeKey(key: string): string {
    if (key) return `${this._prefix}${this._schema.name}:${key}`;
    return this._schema.name;
  }

  private _parseJSON(value) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  }
}
