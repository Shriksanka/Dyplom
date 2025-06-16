import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotsModule } from './bots/bots.module';
import { RouterModule } from '@nestjs/core';
import { BsModule } from './bots/bsb/bs.module';
import { P2pModule } from './bots/p2p/p2p.module';
import { ProvidersModule } from './bots/bsb/providers/providers.module';
import { CommonModule } from './bots/p2p/providers/common/common.module';
import { S3Module } from 'nestjs-s3';
import { RedisModule } from '@nestjs-modules/ioredis';
import { RepositoryModule } from './database/redis/core/repositort.module';
import { OtpsSchema } from './database/redis/schemas/otp.schema';
import { GdrivesSchema } from './database/redis/schemas/gdrives.schema';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SequelizeModule } from '@nestjs/sequelize';
import { DatabaseModule } from './database/mysql/database.module';
import { UserModule } from './api/user/user.module';
import { SuccessOrderBotModule } from './bots/so/so.module';
import { GdriveFilesSchema } from './database/redis/schemas/gdrive-files.schema';
import { WalletSetupStateSchema } from './database/redis/schemas/wallet-setup';
import { WalletSetupModule } from './bots/p2p/scenes/wallet-setup/wallet-setup.module';
import { SupportTicketsSchema } from './database/redis/schemas/support-tickets.schema';
import { AppController } from './app.controller';
import { TelegramMtprotoModule } from './common/telegram-mtproto/telegram-mtproto.module';
import { ApiModule } from './api/api.module';
import { ReportTriggerModule } from './bots/p2p/strategy/triggers/report-trigger.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SuccessOrderBotModule,
    TelegramMtprotoModule,
    ReportTriggerModule,
    BotsModule,
    ProvidersModule,
    RedisModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get('REDIS_HOST'),
      }),
      inject: [ConfigService],
    }),
    RepositoryModule.register({
      schemas: [
        OtpsSchema,
        GdrivesSchema,
        GdriveFilesSchema,
        WalletSetupStateSchema,
        SupportTicketsSchema,
      ],
    }),
    S3Module.forRoot({
      config: {
        forcePathStyle: true,
      },
    }),
    WebhooksModule,
    RouterModule.register([
      { path: 'common', module: CommonModule },
      { path: 'bot/bs', module: BsModule },
      { path: 'bot/so', module: SuccessOrderBotModule },
      {
        path: 'bot/p2p',
        module: P2pModule,
        children: [{ path: 'wallet-setup', module: WalletSetupModule }],
      },
      { path: 'webhook', module: WebhooksModule },
    ]),
    SequelizeModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        dialect: 'mysql',
        dialectModule: require('mysql2'),
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadModels: true,
        synchronize: false,
        logging: false,
        retry: {
          max: 5,
          backoff: 'exponential',
          timeout: 10000,
        },
        pool: {
          max: 5,
          min: 1,
          idle: 10_000,
          acquire: 30_000,
        },
      }),
    }),
    DatabaseModule,
    UserModule,
    ApiModule,
  ],
})
export class AppModule {}
