import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotsModule } from './bots/bots.module';
import { RouterModule } from '@nestjs/core';
import { P2pModule } from './bots/p2p/p2p.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import { RepositoryModule } from './database/redis/core/repositort.module';
import { OtpsSchema } from './database/redis/schemas/otp.schema';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SupportTicketsSchema } from './database/redis/schemas/support-tickets.schema';
import { AppController } from './app.controller';
import { TelegramMtprotoModule } from './common/telegram-mtproto/telegram-mtproto.module';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TelegramMtprotoModule,
    BotsModule,
    RedisModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get('REDIS_HOST'),
      }),
      inject: [ConfigService],
    }),
    RepositoryModule.register({
      schemas: [OtpsSchema, SupportTicketsSchema],
    }),
    WebhooksModule,
    RouterModule.register([
      {
        path: 'bot/p2p',
        module: P2pModule,
      },
      { path: 'webhook', module: WebhooksModule },
    ]),
  ],
})
export class AppModule {}
