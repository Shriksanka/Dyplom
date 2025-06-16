import { Module, OnModuleInit } from '@nestjs/common';
import { P2pService } from './p2p.service';
import { MerchantApiModule } from '../../common/merchant/merchant.module';
import { P2pUpdates } from './p2p.updates';
import { CommonModule } from './providers/common/common.module';
import { P2pController } from './p2p.controller';
import { PaymentServiceModule } from '../../common/payment-service/payment-service.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InjectBot, TelegrafModule } from 'nestjs-telegraf';
import { Redis as TelegrafRedis } from '@telegraf/session/redis';
import { Telegraf, session } from 'telegraf';
import { WalletSetupModule } from './scenes/wallet-setup/wallet-setup.module';
import { ReportScene } from './scenes/report.scene';
import { FxReportStatsScene } from './scenes/fxstats_report.scene';
import { FxReportScene } from './scenes/fxreport_pending.scene';
import { SheetsService } from '../../common/googleapis/sheets/sheets.service';
import { ReportTriggersService } from './strategy/triggers/report-trigger.service';
import { ReportStrategyModule } from './strategy/report-strategy.module';
import { ReportDetailedScene } from './scenes/report_detailed.scene';
import { NotifyAccountScene } from './scenes/notify_account.scene';

@Module({
  imports: [
    MerchantApiModule,
    CommonModule,
    PaymentServiceModule,
    ConfigModule,
    WalletSetupModule,
    ReportStrategyModule,
    TelegrafModule.forRootAsync({
      botName: 'p2p',
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        token: config.get<string>('P2P_BOT_TOKEN'),
        include: [P2pModule],
        launchOptions:
          // NOTE: only create inactive bot for hosted environments
          config.get<string>('APP_ENV') === 'localhost' ? {} : false,
        middlewares: [
          session({
            store: TelegrafRedis({
              url: `redis://${config.get<string>('REDIS_HOST')}`,
            }),
          }),
        ],
      }),
    }),
  ],

  providers: [
    P2pUpdates,
    P2pService,
    ReportScene,
    ReportDetailedScene,
    FxReportStatsScene,
    FxReportScene,
    SheetsService,
    ReportTriggersService,
    NotifyAccountScene,
  ],
  exports: [P2pService],
  controllers: [P2pController],
})
export class P2pModule implements OnModuleInit {
  constructor(
    @InjectBot('p2p') private readonly p2pBot: Telegraf,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // NOTE: set webhook for hosted environments only
    if (this.configService.get<string>('APP_ENV') !== 'localhost') {
      const webhookInfo = await this.p2pBot.telegram.getWebhookInfo();

      const shouldResetWebhook = !webhookInfo.url;

      if (shouldResetWebhook) {
        console.log('Resetting webhook for p2p bot...');
        await this.p2pBot.createWebhook({
          domain: this.configService.get<string>('WEBHOOK_DOMAIN'),
          path: this.configService.get<string>('P2P_BOT_WEBHOOK_PATH'),
        });
        console.log('Webhook reset for p2p bot...');
      }
    }
  }
}
