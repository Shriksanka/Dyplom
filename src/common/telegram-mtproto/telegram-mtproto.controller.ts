import { Controller, Post, Body } from '@nestjs/common';
import { TelegramMtprotoService } from './telegram-mtproto.service';

@Controller('telegram')
export class TelegramMtprotoController {
  constructor(private readonly telegramService: TelegramMtprotoService) {}

  @Post('process-messages')
  async processMessages(@Body() body: { chatId: number }) {
    await this.telegramService.processChatMessages(body.chatId);
    return { status: `Processing messages for chat ${body.chatId}` };
  }

  @Post('otp')
  async handleOtp(@Body('code') code: string) {
    await this.telegramService.enterOtp(code);
    return { success: true, message: 'OTP successfully transferred' };
  }
}
