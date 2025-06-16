import { Schema } from '../core/schema/schema';
import { z } from 'zod';

const GdriveFiles = z.object({
  createdTime: z.string(),
});

export const GdriveFilesSchema = new Schema('GdriveFiles', GdriveFiles);

export type GdriveFiles = z.infer<typeof GdriveFiles>;
