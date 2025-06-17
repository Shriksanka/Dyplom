import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { P2pActions } from './enums';
import { Telegraf } from 'telegraf';
import { OtpRetryDto } from '../../dto/otp-retry.dto';

@Injectable()
export class P2pService {
  constructor(@InjectBot('p2p') private bot: Telegraf) {}

  async askOtp(data: any): Promise<Message.TextMessage> {
    const resp = await this.bot.telegram.sendMessage(
      data.chat_id,
      `Please provide code that was sent to your mobile number.`,
      { parse_mode: 'HTML' },
    );
    return resp;
  }

  async askOtpRetry(data: OtpRetryDto): Promise<Message.TextMessage> {
    const resp = await this.bot.telegram.sendMessage(
      data.chat_id,
      `Time to enter the OTP code has expired for bulk ${data.csv_name}. Would you like to try again?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Yes',
                callback_data: 'yes',
              },
              {
                text: 'No',
                callback_data: 'no',
              },
            ],
          ],
        },
      },
    );
    return resp;
  }
}
