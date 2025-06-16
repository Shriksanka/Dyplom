import { Schema } from '../core/schema/schema';
import { z } from 'zod';

const SupportTickets = z.object({
  ticketId: z.string(),
});

export const SupportTicketsSchema = new Schema(
  'SupportTickets',
  SupportTickets,
);

export type SupportTickets = z.infer<typeof SupportTickets>;
