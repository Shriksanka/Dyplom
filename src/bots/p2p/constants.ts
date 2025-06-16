export const thresholds = [
  { icon: '🔴', color: 'red', condition: (v: number) => v > 50000 },
  { icon: '🟠', color: 'orange', condition: (v: number) => v > 25000 },
  { icon: '🟡', color: 'yellow', condition: (v: number) => v > 5000 },
  { icon: '🟢', color: 'green', condition: (_: number) => true },
];

export const USAGE_CATEGORIES = [
  { max: 30, icon: '🟢' },
  { max: 80, icon: '🟡' },
  { max: Infinity, icon: '🔴' },
];

export const FX_PROVIDER_COMMITMENTS: Record<string, number> = {
  ALS: 30_000_000,
  PAT: 30_000_000,
  BEN: 10_000_000,
  MHT: 10_000_000,
  STC: 10_000_000,
  DGP: 5_000_000,
  MAT: 5_000_000,
  TG: 5_000_000,
  RPG: 5_000_000,
  DIA: 5_000_000,
  DGC: 5_000_000,
};

export const FX_PROVIDER_TIERS: Record<number, string[]> = {
  1: ['ALS', 'PAT', 'BEN', 'MHT', 'STC'],
  2: ['DGP', 'MAT', 'TG'],
  3: ['RPG', 'DIA', 'DGC'],
};

export const FX_TIER_MEDALS: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};
