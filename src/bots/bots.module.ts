import { Module } from '@nestjs/common';
import { P2pModule } from './p2p/p2p.module';
import { BotController } from './bot.controller';
import { BotService } from './bot.sevice';

@Module({
  exports: [BotService],
  imports: [P2pModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotsModule {}
