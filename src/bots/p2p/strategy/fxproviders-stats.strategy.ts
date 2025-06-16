import { Injectable } from '@nestjs/common';
import { ReportStrategy } from './report-strategy.interface';
import { FxStatsReportDto } from '../providers/common/dto';
import { ReportTrigger } from './triggers/report-trigger.interface';
import { SheetsService } from '../../../common/googleapis/sheets/sheets.service';
import {
  FX_PROVIDER_COMMITMENTS,
  FX_PROVIDER_TIERS,
  FX_TIER_MEDALS,
} from '../constants';

@Injectable()
export class FxProviderStatsStrategy
  implements ReportStrategy<FxStatsReportDto>
{
  constructor(private readonly sheetsService: SheetsService) {}

  supports(type: string): boolean {
    return type === 'fx-stats';
  }

  async generateReport(data: FxStatsReportDto): Promise<string> {
    const { date, time_ist, time_cet, exchange_stats } = data;

    const sortedStats = [...exchange_stats].sort(
      (a, b) => b.inr_sent - a.inr_sent,
    );

    const lines: string[] = [
      `📊 Statistics for ${date} ${time_ist} (IST) ${time_cet} (CET)\n`,
    ];

    const localTiers: Record<number, string[]> = {
      1: [...FX_PROVIDER_TIERS[1]],
      2: [...FX_PROVIDER_TIERS[2]],
      3: [...FX_PROVIDER_TIERS[3]],
    };

    const knownProviders = new Set([
      ...FX_PROVIDER_TIERS[1],
      ...FX_PROVIDER_TIERS[2],
      ...FX_PROVIDER_TIERS[3],
    ]);

    for (const stat of exchange_stats) {
      if (!knownProviders.has(stat.provider)) {
        localTiers[2].push(stat.provider);
      }
    }

    for (const tier of [1, 2, 3]) {
      const tierProviders = localTiers[tier];
      const statsForTier = sortedStats.filter((stat) =>
        tierProviders.includes(stat.provider),
      );

      if (statsForTier.length === 0) continue;

      lines.push(`${FX_TIER_MEDALS[tier]} TIER ${tier}\n`);

      for (const stats of statsForTier) {
        const our_usdt = stats.avg_rate
          ? stats.inr_sent_our / stats.avg_rate
          : 0;
        const p2p_usdt = stats.avg_rate
          ? stats.inr_sent_p2p / stats.avg_rate
          : 0;

        const commitment = FX_PROVIDER_COMMITMENTS[stats.provider] || 0;
        const remaining = Math.max(0, commitment - stats.inr_sent);

        lines.push(
          `💰${stats.provider}:`,
          `Total Sent: ${stats.inr_sent.toLocaleString(
            'en-US',
          )} INR = ${stats.expected_usdt.toLocaleString('en-US')} USDT`,
          `Sent OUR: ${stats.inr_sent_our.toLocaleString(
            'en-US',
          )} INR = ${our_usdt.toLocaleString('en-US')} USDT`,
          `Sent P2P: ${stats.inr_sent_p2p.toLocaleString(
            'en-US',
          )} INR = ${p2p_usdt.toLocaleString('en-US')} USDT`,
          ``,
          `Received: ${stats.usdt_received.toLocaleString('en-US')} USDT`,
          `Average rate: ${stats.avg_rate}`,
          `Settlement completed at <u>${stats.settlement_completed_percent.toFixed(
            2,
          )}%</u>`,
          `\nCommitment remaining: ${remaining.toLocaleString('en-US')} INR`,
          `\n`,
        );
      }
    }

    return lines.join('\n');
  }

  getDefaultTriggers(): ReportTrigger[] {
    return [
      {
        type: 'fx-stats',
        chat_id: -1002255749292,
        interval: 3600,
        startAtMinute: 0,
        getData: (): Promise<FxStatsReportDto> =>
          this.sheetsService.getExchangeStats(),
      },
    ];
  }
}
