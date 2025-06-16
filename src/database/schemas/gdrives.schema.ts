import { Schema } from '../core/schema/schema';
import { z } from 'zod';

const Gdrives = z.object({
  id: z.string().optional(),
  resourceId: z.string().optional(),
  pageToken: z.string().optional(),
  folderId: z.string().optional(),
  expire: z.string().optional(),
});

export const GdrivesSchema = new Schema('Gdrive', Gdrives);

export type Gdrives = z.infer<typeof Gdrives>;
