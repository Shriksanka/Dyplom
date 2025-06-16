import { Schema } from '../core/schema/schema';
import { z } from 'zod';

const Otps = z.object({
  text: z.string().optional(),
});

export const OtpsSchema = new Schema('Otps', Otps);

export type Otps = z.infer<typeof Otps>;
