import { Injectable } from '@nestjs/common';
import { ReportStrategy } from './report-strategy.interface';
import { ProcessDataDto, AccountCapacityDto } from '../providers/common/dto';
import { USAGE_CATEGORIES } from '../constants';
import { SheetsService } from '../../../common/googleapis/sheets/sheets.service';
import { ReportTrigger } from './triggers/report-trigger.interface';

@Injectable()
export class CapacityDetailedStrategy
  implements ReportStrategy<ProcessDataDto>
{
  constructor(private readonly sheetsService: SheetsService) {}

  supports(type: string): boolean {
    return type === 'capacity-detailed';
  }

  async generateReport(data: ProcessDataDto): Promise<string> {
    const capacityProviders = this._classifyData(data.capacity);
    const potentialProviders = this._classifyData(data.potential_capacity);

    return this._formatDetailedReport(capacityProviders, potentialProviders);
  }

  private _classifyData(sheetData: AccountCapacityDto[]) {
    const classified: Record<string, string[]> = {};

    for (const { provider, account, limits, used, left } of sheetData) {
      if (!account || limits <= 0) continue;

      const percent = (used / limits) * 100;
      const icon = USAGE_CATEGORIES.find((c) => percent <= c.max)?.icon || '🔴';

      const line = `${icon} ${account} (${percent.toFixed(
        1,
      )}%) &lt${left.toLocaleString('en-US')}&gt`;

      if (!classified[provider]) classified[provider] = [];

      classified[provider].push(line);
    }

    return classified;
  }

  private _formatDetailedReport(
    capacity: Record<string, string[]>,
    potential: Record<string, string[]>,
  ): string {
    const lines: string[] = ['📊 <b>Account Usage Breakdown:</b>\n'];

    for (const [provider, rows] of Object.entries(capacity)) {
      lines.push(`<b>${provider}:</b>`, ...rows, '');
    }

    for (const [provider, rows] of Object.entries(potential)) {
      lines.push(`<b>${provider} (Potential):</b>`, ...rows, '');
    }

    return lines.join('\n');
  }

  getDefaultTriggers(): ReportTrigger[] {
    return [
      {
        type: 'capacity-detailed',
        chat_id: -1002255749292,
        interval: 1800,
        startAtMinute: 0,
        getData: (): Promise<ProcessDataDto> =>
          this.sheetsService.getFullCapacityData(),
      },
    ];
  }
}
