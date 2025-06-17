import { Controller, Headers, Post } from '@nestjs/common';
import { TelegramMtprotoService } from './common/telegram-mtproto/telegram-mtproto.service';

@Controller()
export class AppController {
  constructor(private readonly telegramService: TelegramMtprotoService) {}

  @Post('step-functions')
  async stepFunctionsHandler(@Headers() headers: any) {
    const session = await this.telegramService.getSession();
    if (session) {
      await this.telegramService.processChatMessages(event.chat_id);
    }

    console.log('headers >>>', headers);

    return { message: 'ok' };
  }
}
