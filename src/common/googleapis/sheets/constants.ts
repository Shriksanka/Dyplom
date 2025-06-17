import { AccountCapacityDto } from '../../../bots/p2p/dto';

export const CAPACITY_STATUS_MAP = (
  capacity: AccountCapacityDto[],
  potential: AccountCapacityDto[],
): Record<string, AccountCapacityDto[]> => ({
  'N/A': capacity,
  'NO OTP': potential,
  'NO REPLY': potential,
  'NO BEN': potential,
  'SERVER ISSUE': potential,
});
