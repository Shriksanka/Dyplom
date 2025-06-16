import { Module } from '@nestjs/common';
import { ReportTriggersService } from './triggers/report-trigger.service';
import { ReportStrategiesService } from './report-strategy.service';
import { FxDebtReportStrategy } from './fxproviders-debt.strategy';
import { FxProviderStatsStrategy } from './fxproviders-stats.strategy';
import { CapacityDetailedStrategy } from './capacity-detailed.strategy';
import { CapacitySummaryStrategy } from './capacity-summary.strategy';
import { SheetsService } from '../../../common/googleapis/sheets/sheets.service';

@Module({
  providers: [
    ReportStrategiesService,
    ReportTriggersService,
    FxDebtReportStrategy,
    FxProviderStatsStrategy,
    CapacityDetailedStrategy,
    CapacitySummaryStrategy,
    SheetsService,
    ReportStrategiesService,
  ],
  exports: [ReportStrategiesService],
})
export class ReportStrategyModule {}
