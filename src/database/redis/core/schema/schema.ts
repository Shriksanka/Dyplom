import { ZodSchema } from 'zod';

export class Schema {
  name: string;
  definition: ZodSchema;

  constructor(schemaName: string, schemaDef: ZodSchema) {
    this.name = schemaName;
    this.definition = schemaDef;

    this._validateOptions();
  }

  validateSchema(entity: Record<string, any>) {
    this.definition.parse(entity);
  }

  private _validateOptions() {
    if (this.name === '')
      throw new Error('Schema name must be a non-empty string.');
  }
}
