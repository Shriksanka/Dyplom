import { z } from 'zod';
import { Schema } from '../core/schema/schema';

const ReportState = z.object({
  last_triggered_at: z.number().optional(),
  is_processing: z.boolean().optional(),
});

export const ReportStateSchema = new Schema('ReportState', ReportState);
export type ReportState = z.infer<typeof ReportState>;
