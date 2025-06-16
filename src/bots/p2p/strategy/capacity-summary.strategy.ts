import { Injectable } from '@nestjs/common';
import { ReportStrategy } from './report-strategy.interface';
import { ProcessDataDto } from '../providers/common/dto';
import { AccountCapacityDto } from '../providers/common/dto';
import { USAGE_CATEGORIES } from '../constants';
import { SheetsService } from '../../../common/googleapis/sheets/sheets.service';
import { ReportTrigger } from './triggers/report-trigger.interface';

@Injectable()
export class CapacitySummaryStrategy implements ReportStrategy<ProcessDataDto> {
  constructor(private readonly sheetsService: SheetsService) {}

  supports(type: string): boolean {
    return type === 'capacity-summary';
  }

  async generateReport(data: ProcessDataDto): Promise<string> {
    const capacityProviders = this._classifyData(data.capacity);
    const potentialProviders = this._classifyData(data.potential_capacity);

    const usedTillNow = await this.sheetsService.getAi2UsedTotal();

    return this._formatSummaryReport(
      capacityProviders,
      potentialProviders,
      usedTillNow,
    );
  }

  private _classifyData(
    sheetData: AccountCapacityDto[],
  ): Record<
    string,
    { total_limits: number; total_used: number; total_left: number }
  > {
    return sheetData.reduce(
      (acc, { provider, limits, used, left, account }) => {
        if (!account || limits <= 0) return acc;

        if (!acc[provider]) {
          acc[provider] = { total_limits: 0, total_used: 0, total_left: 0 };
        }

        acc[provider].total_limits += limits;
        acc[provider].total_used += used;
        acc[provider].total_left += left;

        return acc;
      },
      {} as Record<
        string,
        { total_limits: number; total_used: number; total_left: number }
      >,
    );
  }

  private _formatSummaryReport(
    capacity: Record<
      string,
      { total_limits: number; total_used: number; total_left: number }
    >,
    potential: Record<
      string,
      { total_limits: number; total_used: number; total_left: number }
    >,
    usedTillNow: number,
  ): string {
    let totalLeft = 0;
    let totalLimit = 0;
    let totalPotentialLeft = 0;

    const above30: string[] = [];
    const below30: string[] = [];

    for (const [
      provider,
      { total_limits, total_used, total_left },
    ] of Object.entries(capacity)) {
      const percent =
        total_limits > 0
          ? (total_used / total_limits) * 100
          : total_used > 0
          ? 100
          : 0;

      const icon = USAGE_CATEGORIES.find((c) => percent <= c.max)?.icon || '🔴';
      const line = `${icon} ${provider}: ${total_used.toLocaleString(
        'en-US',
      )} INR (${percent.toFixed(1)}%)`;

      (percent > 30 ? above30 : below30).push(line);

      totalLeft += total_left;
      totalLimit += total_limits;
    }

    const potentialLines: string[] = [];

    for (const [provider, { total_left }] of Object.entries(potential)) {
      totalPotentialLeft += total_left;
      const icon = total_left > 0 ? '🟢' : '🔴';
      const line = `${icon} ${provider}: ${total_left.toLocaleString(
        'en-US',
      )} INR`;
      potentialLines.push(line);
    }

    const totalPercent =
      totalLimit + totalPotentialLeft > 0
        ? (usedTillNow / (totalLimit + totalPotentialLeft)) * 100
        : 0;

    const reportLines = [
      `📊 <b>Total Capacity Today:</b> <i>${totalLimit.toLocaleString(
        'en-US',
      )} INR</i>`,
      ``,
      `<b>Used till now:</b> <i>${usedTillNow.toLocaleString(
        'en-US',
      )} INR</i> (${totalPercent.toFixed(1)}%)`,
      `<b>Left:</b> <i>${totalLeft.toLocaleString('en-US')} INR</i>`,
      ``,
      `🔼 <b>Above 30%</b>`,
      above30.length ? above30.join('\n') : '_No data_',
      ``,
      `🔽 <b>Below 30%</b>`,
      below30.length ? below30.join('\n') : '_No data_',
    ];

    if (potentialLines.length) {
      reportLines.push(
        ``,
        `💡 <b>Potential Additional Capacity:</b>${totalPotentialLeft.toLocaleString(
          'en-US',
        )} INR`,
        potentialLines.join('\n'),
      );
    }

    return reportLines.join('\n');
  }

  getDefaultTriggers(): ReportTrigger[] {
    return [
      {
        type: 'capacity-summary',
        chat_id: -4223103414,
        interval: 3600,
        startAtMinute: 0,
        getData: (): Promise<ProcessDataDto> =>
          this.sheetsService.getFullCapacityData(),
      },
      {
        type: 'capacity-summary',
        chat_id: -1002255749292,
        interval: 1800,
        startAtMinute: 0,
        getData: (): Promise<ProcessDataDto> =>
          this.sheetsService.getFullCapacityData(),
      },
    ];
  }
}
