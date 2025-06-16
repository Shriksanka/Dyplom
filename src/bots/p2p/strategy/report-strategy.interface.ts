import { ReportTrigger } from './triggers/report-trigger.interface';

export interface ReportStrategy<dto = any> {
  supports(type: string): boolean;
  generateReport(data: dto): Promise<string>;

  getDefaultTriggers?(): ReportTrigger[];
}
