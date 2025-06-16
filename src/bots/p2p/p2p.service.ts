import { Injectable } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { WithdrawalMethodDto } from 'src/dto/withdrawal-method.dto';
import { Message } from 'telegraf/typings/core/types/typegram';
import { P2pActions } from './enums';
import { Telegraf } from 'telegraf';
import { IterationSucceedDto } from 'src/dto/succeed-iteration.dto';
import { IterationErroredDto } from 'src/dto/errored-iteration.dto';
import { OtpRetryDto } from '../../dto/otp-retry.dto';
import { FxStatsReportDto } from './providers/common/dto';
import { FxDebtReportDto } from './providers/common/dto';
import { DateTime } from 'luxon';
import { thresholds } from './constants';

@Injectable()
export class P2pService {
  constructor(@InjectBot('p2p') private bot: Telegraf) {}

  async askWithdrawalMethod(
    data: WithdrawalMethodDto,
  ): Promise<Message.TextMessage> {
    // const [task] = await this.tasksService.findByTaskId(data.task_id);
    // if (!task)
    //   await this.tasksService.create({
    //     id: data.task_id,
    //     source: TaskSource.TasksInputWithdrawal,
    //     ...data,
    //   });
    return await this.bot.telegram.sendMessage(
      data.chat_id,
      `Total pending withdrawals for <b>${data.wallet_name}</b> is <b>${data.amount}</b> INR. Current account balance is <b>₹${data.balance}</b> Please choose between <b>IMPS</b> or <b>NEFT</b> bulk withdrawal?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'IMPS',
                callback_data: `${P2pActions.IMPS}|${data.wallet_name}|${data.amount}|${data.task_id}`,
              },
              {
                text: 'NEFT',
                callback_data: `${P2pActions.NEFT}|${data.wallet_name}|${data.amount}|${data.task_id}`,
              },
            ],
          ],
        },
        parse_mode: 'HTML',
      },
    );
  }

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

  async succeedIteration(
    data: IterationSucceedDto,
  ): Promise<Message.TextMessage> {
    const resp = await this.bot.telegram.sendMessage(
      data.chat_id,
      `ITERATION with <b>${data.csv_name}</b> has finished for <b>${data.wallet_name}<b> bank account. Bulk format was: <b>${data.protocol_name}</b>
Total amount: <b>${data.amount}</b>
Current Balance on Bank account is: <b>${data.wallet_balance}</b>
Trx status: sent <b>${data.status.sent}</b>, added <b>${data.status.added}</b>, failed: <b>${data.status.faiked}</b> transactions
`,
      { parse_mode: 'HTML' },
    );
    return resp;
  }

  async erroredIteration(
    data: IterationErroredDto,
  ): Promise<Message.TextMessage> {
    const resp = await this.bot.telegram.sendMessage(
      data.chat_id,
      `Latest BULK – <b>${data.csv_name}</b> - failed to be processed by the Bank for <b>${data.wallet_name}</b> bank account. Should BOT try again to initiate the same Bulk?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Yes',
                callback_data: `1`,
              },
              {
                text: 'Check',
                callback_data: `2`,
              },
              {
                text: 'Manual',
                callback_data: `3`,
              },
            ],
          ],
        },
        parse_mode: 'HTML',
      },
    );
    return resp;
  }
}
