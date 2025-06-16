import { Schema } from '../core/schema/schema';
import { z } from 'zod';

const TelegramState = z.object({
  session: z.string().optional(),
  last_message_id: z.number().optional(),
});

export const TelegramStateSchema = new Schema('TelegramState', TelegramState);

export type TelegramState = z.infer<typeof TelegramState>;
