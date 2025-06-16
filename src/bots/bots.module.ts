import { Module } from '@nestjs/common';
import { P2pModule } from './p2p/p2p.module';
import { BsModule } from './bsb/bs.module';
import { SuccessOrderBotModule } from './so/so.module';
import { BotController } from './bot.controller';
import { DatabaseModule } from '../database/mysql/database.module';
import { BotService } from './bot.sevice';

@Module({
  exports: [BotService],
  imports: [P2pModule, BsModule, SuccessOrderBotModule, DatabaseModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotsModule {}
