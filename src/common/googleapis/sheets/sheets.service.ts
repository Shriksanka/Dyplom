import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import {
  AccountCapacityDto,
  FxProviderStatsDto,
  FxStatsReportDto,
  FxDebtDto,
  FxDebtReportDto,
  AccDataDto,
} from '../../../bots/p2p/dto';
import { CAPACITY_STATUS_MAP } from './constants';

@Injectable()
export class SheetsService {
  private _sheets: sheets_v4.Sheets;

  constructor(private readonly config: ConfigService) {
    const auth = this._authorize();
    this._sheets = google.sheets({ version: 'v4', auth });
  }

  private _authorize() {
    const authClient = new google.auth.OAuth2(
      this.config.get('SHEETS_CLIENT_ID'),
      this.config.get('SHEETS_CLIENT_SECRET'),
      this.config.get('SHEETS_REDIRECT_URL'),
    );

    authClient.setCredentials({
      refresh_token: this.config.get('SHEETS_REFRESH_TOKEN'),
    });

    return authClient;
  }

  private _parseAmount(val: string | number): number {
    return parseFloat(String(val).replace(/,/g, '')) || 0;
  }

  async getFullCapacityData(): Promise<{
    capacity: AccountCapacityDto[];
    potential_capacity: AccountCapacityDto[];
  }> {
    const spreadsheetId = this.config.get<string>('SHEETS_SPREADSHEET_ID');
    const range = 'Accounts Capacity (Automation)';

    const { data } = await this._sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const [headerRow, ...rows] = data.values || [];

    const headers = headerRow.map((h) => h.toLowerCase().trim());
    const capacity: AccountCapacityDto[] = [];
    const potential_capacity: AccountCapacityDto[] = [];

    const statusMap = CAPACITY_STATUS_MAP(capacity, potential_capacity);

    let lastProvider = '',
      lastStatus = '';

    for (const row of rows) {
      const rowData = Object.fromEntries(
        headers.map((key, i) => [key, String(row[i] ?? '').trim()]),
      );

      if (!rowData.account) continue;

      rowData.provider = rowData.provider || lastProvider;
      rowData.status = (rowData.status || lastStatus).toUpperCase();

      lastProvider = rowData.provider;
      lastStatus = rowData.status;

      const entry: AccountCapacityDto = {
        provider: rowData.provider,
        account: rowData.account,
        limits: this._parseAmount(rowData.limits || '0'),
        used: this._parseAmount(rowData.used || '0'),
        left: this._parseAmount(rowData.left || '0'),
        status: rowData.status,
      };

      const target = statusMap[entry.status];
      if (target) target.push(entry);
    }

    return { capacity, potential_capacity };
  }

  async getExchangeStats(): Promise<FxStatsReportDto> {
    const spreadsheetId = this.config.get('SHEETS_SPREADSHEET_ID');
    const range = 'Transactions!A3:O';

    console.log('[FxStatsReport] Fetching range:', range);
    console.log('[FxStatsReport] Spreadsheet ID:', spreadsheetId);
    // const { data } = await this._sheets.spreadsheets.values.get({
    //   spreadsheetId: this.config.get('SHEETS_SPREADSHEET_ID'),
    //   range: 'Transactions!A3:O',
    // });

    try {
      const { data } = await this._sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = (data.values || []).filter((row) => row.some(Boolean));
      const recentRows = rows.slice(-300);
      const todayIST = this.getTodayIST();

      const statsMap: Record<
        string,
        {
          inr_sent_our: number;
          inr_sent_p2p: number;
          fx_rates: number[];
          usdt_received: number;
        }
      > = {};

      for (const row of recentRows) {
        const [
          ,
          rawDate,
          transactionType,
          inrStr,
          ,
          fxStr,
          usdtStr,
          comment,
          ,
          ,
          channel,
          ,
          ,
          providerExchange,
          movementType,
        ] = row;

        if (!rawDate || transactionType !== 'Exchange') continue;
        if (comment?.toUpperCase().trim() === 'ADJUSTMENT') continue;
        if (movementType !== 'Exchange' && movementType !== 'Settlements')
          continue;

        const parsedDate = this.normalizeToISTDate(rawDate);
        if (!parsedDate || parsedDate.getTime() !== todayIST.getTime())
          continue;

        const provider =
          movementType === 'Exchange' ? providerExchange : row[9];
        if (!provider) continue;

        const inr = this._parseAmount(inrStr);
        const fx = this._parseAmount(fxStr);
        const usdt = this._parseAmount(usdtStr);
        const isP2P = (channel || '').toUpperCase().includes('P2P');

        statsMap[provider] ??= {
          inr_sent_our: 0,
          inr_sent_p2p: 0,
          fx_rates: [],
          usdt_received: 0,
        };

        if (movementType === 'Exchange') {
          if (isP2P) {
            statsMap[provider].inr_sent_p2p += inr;
          } else {
            statsMap[provider].inr_sent_our += inr;
          }
          if (fx > 0) statsMap[provider].fx_rates.push(fx);
        } else if (movementType === 'Settlements') {
          statsMap[provider].usdt_received += usdt;
        }
      }

      const exchange_stats: FxProviderStatsDto[] = Object.entries(statsMap).map(
        ([provider, stats]) => {
          const inr_sent = stats.inr_sent_our + stats.inr_sent_p2p;
          const avg_rate = stats.fx_rates.length
            ? stats.fx_rates.reduce((sum, r) => sum + r, 0) /
              stats.fx_rates.length
            : 0;
          const expected_usdt = avg_rate ? inr_sent / avg_rate : 0;
          const completion = expected_usdt
            ? (stats.usdt_received / expected_usdt) * 100
            : 0;

          return {
            provider,
            inr_sent: +inr_sent.toFixed(2),
            inr_sent_our: +stats.inr_sent_our.toFixed(2),
            inr_sent_p2p: +stats.inr_sent_p2p.toFixed(2),
            avg_rate: +avg_rate.toFixed(2),
            expected_usdt: +expected_usdt.toFixed(2),
            usdt_received: +stats.usdt_received.toFixed(2),
            settlement_completed_percent: +completion.toFixed(2),
          };
        },
      );

      const now = new Date();

      return {
        date: now.toLocaleDateString('en-GB'),
        time_ist: now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Kolkata',
        }),
        time_cet: now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Berlin',
        }),
        exchange_stats,
      };
    } catch (error) {
      console.error('[FxStatsReport] Google API Error:', error.message);
      console.error('[FxStatsReport] Full error:', error);
      throw error;
    }
  }

  private getTodayIST(): Date {
    const istNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
    );
    istNow.setHours(0, 0, 0, 0);
    return istNow;
  }

  private normalizeToISTDate(input: string | Date): Date | null {
    let dateObj: Date;

    if (input instanceof Date) {
      dateObj = input;
    } else if (typeof input === 'string') {
      const separator = input.includes('/')
        ? '/'
        : input.includes('-')
        ? '-'
        : null;

      if (separator) {
        const [dd, mm, yyyy] = input.split(separator);
        if (!dd || !mm || !yyyy) return null;
        dateObj = new Date(+yyyy, +mm - 1, +dd);
      } else {
        return null;
      }
    } else {
      return null;
    }

    const istString = dateObj.toLocaleString('en-US', {
      timeZone: 'Asia/Kolkata',
    });
    const istDate = new Date(istString);
    istDate.setHours(0, 0, 0, 0);
    return istDate;
  }

  async getFxDebtReport(): Promise<FxDebtReportDto> {
    const parseAmount = (val: string | number): number =>
      parseFloat(String(val).replace(/,/g, ''));

    const spreadsheetId = this.config.get('SHEETS_SPREADSHEET_ID');
    const range = 'Exchange!A2:K';

    // const { data } = await this._sheets.spreadsheets.values.get({
    //   spreadsheetId: this.config.get('SHEETS_SPREADSHEET_ID'),
    //   range: 'Exchange!A2:K',
    // });

    console.log('[FxDebtReport] Fetching range:', range);
    console.log('[FxDebtReport] Spreadsheet ID:', spreadsheetId);

    try {
      const { data } = await this._sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = (data.values || []).filter(
        (row) => row[0] && row[5] && !isNaN(parseAmount(row[5])),
      );

      let total = 0;

      const debts: FxDebtDto[] = rows.reduce((acc, row) => {
        const provider = row[0].toString().trim();
        const value = parseAmount(row[5]);
        const comment = (row[10] || '').toString().trim();

        if (comment === 'BAD DEBT') return acc;

        total += value;

        if (Math.abs(value) >= 1000) {
          acc.push({ provider, usdt: Math.round(value) });
        }

        return acc;
      }, [] as FxDebtDto[]);

      const now = new Date();
      const dateStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
        .format(now)
        .replace(/\//g, '-');

      return {
        date: dateStr,
        debts,
        total: Math.round(total),
      };
    } catch (error) {
      console.error('[FxDebtReport] Google API Error:', error.message);
      console.error('[FxDebtReport] Full error:', error);
      throw error;
    }
  }
  async getAi2UsedTotal(): Promise<number> {
    const { data } = await this._sheets.spreadsheets.values.get({
      spreadsheetId: this.config.get<string>('SHEETS_SPREADSHEET_ID'),
      range: `'Accounts'!AI2`,
    });

    const val = data.values?.[0]?.[0];
    return this._parseAmount(val);
  }

  async getAccountDetails(rowNumber): Promise<AccDataDto | null> {
    const { data } = await this._sheets.spreadsheets.values.get({
      spreadsheetId: this.config.get('SHEETS_SPREADSHEET_ID'),
      range: 'Accounts!B2:P',
    });

    const rowIndex = rowNumber - 2;

    if (rowIndex < 0) return null;

    const row = data.values[rowIndex];

    const dto: AccDataDto = {
      name: row[0],
      provider: row[2],
      commentary: row[13],
      capacity: row[14],
    };

    return dto;
  }
}
