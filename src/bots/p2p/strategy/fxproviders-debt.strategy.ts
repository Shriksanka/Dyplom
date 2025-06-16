import { Injectable } from '@nestjs/common';
import { ReportStrategy } from './report-strategy.interface';
import { FxDebtReportDto } from '../providers/common/dto';
import { DateTime } from 'luxon';
import { thresholds } from '../constants';
import { ReportTrigger } from './triggers/report-trigger.interface';
import { SheetsService } from '../../../common/googleapis/sheets/sheets.service';

@Injectable()
export class FxDebtReportStrategy implements ReportStrategy<FxDebtReportDto> {
  constructor(private readonly sheetsService: SheetsService) {}

  supports(type: string): boolean {
    return type === 'fx-debt';
  }

  async generateReport(data: FxDebtReportDto): Promise<string> {
    const { date, debts, total } = data;

    const istTime = DateTime.now().setZone('Asia/Kolkata').toFormat('HH:mm');
    const cetTime = DateTime.now().setZone('Europe/Warsaw').toFormat('HH:mm');

    const messageHeader = `Statistics for ${date} ${istTime} (IST) ${cetTime} (CET)\n\n📤Pending Debts FX providers:\n`;

    const colorBuckets = thresholds.map(() => [] as string[]);

    for (const { provider, usdt } of debts) {
      const idx = thresholds.findIndex((t) => t.condition(usdt));
      const { icon } = thresholds[idx];

      const formattedUsdt = usdt.toLocaleString('en-US');

      colorBuckets[idx].push(
        `${icon} <b>${provider}</b>:    <i>${formattedUsdt}</i> USDT`,
      );
    }

    const lines = colorBuckets
      .filter((group) => group.length > 0)
      .flatMap((group, i, arr) =>
        i < arr.length - 1 ? [...group, ''] : group,
      );

    const formattedTotal = total.toLocaleString('en-US');

    const totalLine = `\n📊 <b>Total pending for all FX providers:</b> <i>${formattedTotal}</i> USDT`;

    return `${messageHeader}\n${lines.join('\n')}\n${totalLine}`;
  }

  getDefaultTriggers(): ReportTrigger[] {
    return [
      {
        type: 'fx-debt',
        chat_id: -4223103414,
        interval: 3600,
        startAtMinute: 30,
        getData: (): Promise<FxDebtReportDto> =>
          this.sheetsService.getFxDebtReport(),
      },
    ];
  }
}
