import { Module } from '@nestjs/common';
import { TelegramMtprotoService } from './telegram-mtproto.service';
import { ConfigModule } from '@nestjs/config';
import { RepositoryModule } from '../../database/redis/core/repositort.module';
import { TelegramMtprotoController } from './telegram-mtproto.controller';
import { ZendeskModule } from '../zendesk/zendesk.module';
import { TelegramStateSchema } from '../../database/redis/schemas/telegram-state.schema';

@Module({
  imports: [
    ConfigModule,
    RepositoryModule.register({
      schemas: [TelegramStateSchema],
      prefix: 'telegram',
    }),
    ZendeskModule,
  ],
  providers: [TelegramMtprotoService],
  controllers: [TelegramMtprotoController],
  exports: [TelegramMtprotoService],
})
export class TelegramMtprotoModule {}
