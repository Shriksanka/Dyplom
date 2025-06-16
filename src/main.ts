import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getBotToken } from 'nestjs-telegraf';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe());

  const p2pBot = app.get(getBotToken('p2p'));
  app.use(p2pBot.webhookCallback(config.get<string>('P2P_BOT_WEBHOOK_PATH')));

  const port = config.get<number>('PORT') || 3000;
  await app.listen(port);
}

bootstrap();
