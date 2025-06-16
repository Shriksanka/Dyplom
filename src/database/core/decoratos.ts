import { Inject } from '@nestjs/common';
import { getRepositoryToken } from './common/utils';

export const InjectRepository = (model: string) =>
  Inject(getRepositoryToken(model));
