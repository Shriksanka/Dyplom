import {
  IsArray,
  IsNumber,
  IsString,
  ValidateNested,
  IsBoolean,
  IsOptional,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class OtpDto {
  @IsNumber()
  chat_id: string;
  @IsString()
  wallet_name: string;
}

export class ProcessDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountCapacityDto)
  capacity: AccountCapacityDto[];
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountCapacityDto)
  potential_capacity: AccountCapacityDto[];
  @IsNumber()
  @IsOptional()
  chat_id?: number;
}

export class AccountCapacityDto {
  @IsString()
  provider: string;
  @IsString()
  account: string;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  limits: number;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  used: number;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  left: number;
  @IsString()
  status: string;
}

export class FxProviderStatsDto {
  @IsString()
  provider: string;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  inr_sent: number;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  inr_sent_our: number;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  inr_sent_p2p: number;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  avg_rate: number;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  expected_usdt: number;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  usdt_received: number;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  settlement_completed_percent: number;
}

export class FxStatsReportDto {
  @IsString()
  date: string;
  @IsString()
  time_ist: string;
  @IsString()
  time_cet: string;
  @IsNumber()
  @IsOptional()
  chat_id?: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FxProviderStatsDto)
  exchange_stats: FxProviderStatsDto[];
}

export class FxDebtReportDto {
  @IsString()
  date: string;
  @IsNumber()
  @IsOptional()
  chat_id?: number;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FxDebtDto)
  debts: FxDebtDto[];
  @Transform(({ value }) => Number(value))
  @IsNumber()
  total: number;
}

export class FxDebtDto {
  @IsString()
  provider: string;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  usdt: number;
}

export class AccDataDto {
  @IsString()
  name: string;
  @IsString()
  provider: string;
  @Transform(({ value }) => Number(value))
  @IsNumber()
  capacity: number;
  @IsString()
  commentary: string;
}
