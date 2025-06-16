import { Injectable } from '@nestjs/common';
import { ReportStrategy } from './report-strategy.interface';
import { FxProviderStatsStrategy } from './fxproviders-stats.strategy';
import { FxDebtReportStrategy } from './fxproviders-debt.strategy';
import { CapacitySummaryStrategy } from './capacity-summary.strategy';
import { CapacityDetailedStrategy } from './capacity-detailed.strategy';

@Injectable()
export class ReportStrategiesService {
  private readonly strategies: ReportStrategy<any>[];

  constructor(
    private readonly fxStats: FxProviderStatsStrategy,
    private readonly fxDebt: FxDebtReportStrategy,
    private readonly capSummary: CapacitySummaryStrategy,
    private readonly capDetailed: CapacityDetailedStrategy,
  ) {
    this.strategies = [
      this.fxStats,
      this.fxDebt,
      this.capSummary,
      this.capDetailed,
    ];
  }

  getStrategy(type: string): ReportStrategy<any> {
    const strategy = this.strategies.find((report_strategy) =>
      report_strategy.supports(type),
    );
    if (!strategy) return;
    return strategy;
  }

  getAllStrategies(): ReportStrategy<any>[] {
    return this.strategies;
  }
}
