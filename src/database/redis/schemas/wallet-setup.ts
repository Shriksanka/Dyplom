import { Schema } from '../core/schema/schema';
import { z } from 'zod';

const WalletSetupState = z.object({
  typing_action: z.boolean().optional(),
  balances: z
    .object({
      available: z.number(),
      lien: z.number().optional(),
    })
    .optional(),
});

export const WalletSetupStateSchema = new Schema(
  'WalletSetupState',
  WalletSetupState,
);

export type WalletSetupState = z.infer<typeof WalletSetupState>;
