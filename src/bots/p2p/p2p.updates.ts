import { Update, Ctx, Start, Action, Command } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { callbackQuery } from 'telegraf/filters';
import { MerchantApiService } from '../../common/merchant/merchant.service';
import { InjectRepository } from '../../database/redis/core/decoratos';
import { Repository } from '../../database/redis/core/repository';
import { Helpers } from '../../common/helpers';
import { PaymentService } from '../../common/payment-service/payment-service.service';
import { SceneContext } from 'telegraf/scenes';

@Update()
export class P2pUpdates {
  constructor(
    private readonly merchantApiService: MerchantApiService,
    private readonly paymentService: PaymentService,
    @InjectRepository('Otps') private readonly otpRepo: Repository,
  ) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    await ctx.reply(
      `Welcome ${ctx.message.from.username} your id is ${ctx.message.from.id} and your chat id is ${ctx.message.chat.id}`,
    );

    await ctx.telegram.setMyCommands([
      {
        command: 'start',
        description: 'Run to get chat id',
      },
      {
        command: 'reconcile',
        description: 'Transactions reconciliation by date',
      },
      {
        command: 'walet_setup',
        description: 'Starts wallet setup',
      },
      {
        command: 'report',
        description: 'Run to receive summary the accounts usage report',
      },
      {
        command: 'fxreport_stat',
        description: 'Run to receive the overall statistics of FX Providers',
      },
      {
        command: 'fxreport_pending',
        description: 'Run to receive the pendings debts from FX Providers',
      },
      {
        command: 'report_detailed',
        description: 'Run to receive the overall the account usage report',
      },
      {
        command: 'notify_account',
        description:
          'Run to make a notification about account into Operations chat',
      },
    ]);
  }

  @Command('reconcile')
  async reconciliation(@Ctx() ctx: Context) {
    const lastDays = Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);

      return d.toISOString().split('T')[0];
    });

    const keyboard = Helpers.generateInlineKeyboard(lastDays, 'reconcile', 2);

    await ctx.replyWithHTML('Choose date to run the reconciliation', {
      ...keyboard,
      parse_mode: 'HTML',
    });
  }

  @Command('walet_setup')
  async waletSetup(@Ctx() ctx: SceneContext) {
    await ctx.scene.enter('walet_setup');
  }

  @Command('report')
  async onReportCommand(@Ctx() ctx: SceneContext) {
    await ctx.scene.enter('report');
  }

  @Command('report_detailed')
  async onReportDetailedCommand(@Ctx() ctx: SceneContext) {
    await ctx.scene.enter('report_detailed');
  }

  @Command('fxreport_stat')
  async onFxReportStatsCommand(@Ctx() ctx: SceneContext) {
    await ctx.scene.enter('fxreportStats');
  }

  @Command('fxreport_pending')
  async onFxReportCommand(@Ctx() ctx: SceneContext) {
    await ctx.scene.enter('fxreportPending');
  }

  @Command('notify_account')
  async onNotifyAccount(@Ctx() ctx: SceneContext) {
    await ctx.scene.enter('notifyAccount');
  }

  @Action(/NEFT|IMPS/)
  async onNeft(@Ctx() ctx: Context) {
    if (ctx.has(callbackQuery('data'))) {
      const data = ctx.callbackQuery.data.split('|');
      const d = await this.merchantApiService.sendWithdrawalType(data[2]); //TODO Nedd implenets this method

      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
      await ctx.replyWithHTML(
        `Operator <b>${ctx.callbackQuery.from.username}</b> chose <b>${data[0]}</b> withdraw type for <b>${data[1]}</b>`,
      );
    }
  }

  @Action('yes')
  async onOtpRetryYes(@Ctx() ctx: Context) {
    ctx.reply('Accepted', {
      reply_parameters: { message_id: ctx.callbackQuery.message.message_id },
    });
  }

  @Action('no')
  async onOtpRetryNo(@Ctx() ctx: Context) {
    ctx.reply('Accepted', {
      reply_parameters: { message_id: ctx.callbackQuery.message.message_id },
    });
  }

  // @On('text')
  // async OnText(@Ctx() ctx: OtpContext) {
  //   if ('text' in ctx?.message) {
  //     const replyToMes = ctx.message.reply_to_message?.message_id;
  //     if (replyToMes) {
  //       if (!isNaN(Number.parseInt(ctx.message.text))) {
  //         await this.otpRepo.save<Otps>(replyToMes.toString(), {
  //           text: ctx.message.text,
  //         });
  //         await this.otpRepo.expireAt(replyToMes.toString(), 120);

  //         ctx.reply('Accepted', {
  //           reply_parameters: { message_id: replyToMes },
  //         });
  //       }
  //     }
  //   }
  // }

  @Action(/^.*:reconcile$/)
  async processReconciliation(@Ctx() ctx) {
    const [date] = ctx.callbackQuery.data.split(':');

    await ctx.reply(`Processing reconciliation for ${date} started...`);

    try {
      const transactions = await this.merchantApiService.getWithdrawals(date);

      const merchantMap = new Map();
      for (const transaction of transactions) {
        if (['SUCCESS', 'FAILED'].includes(transaction['status'])) {
          merchantMap.set(transaction['external_reference'], transaction);
        }
      }

      const payouts = await this.paymentService.getBwjPayouts(date);
      const missing = payouts.filter((t) => !merchantMap.has(t['agentId']));

      let limited = missing
        .slice(0, 20)
        .map((t) => `id: ${t['id']} agentId: ${t['agentId']}`)
        .join('\n');

      if (missing.length > 20) {
        limited += '\n...';
      }

      await ctx.reply(
        `Reconciliation for ${date} completed. \n Difference: ${
          missing.length
        } \n Missing: ${limited || 'No missing transactions'}`,
      );
    } catch (error) {
      console.error('Reconciliation error: ', error?.response?.data || error);
      await ctx.reply(`Error processing reconciliation for ${date}`);
    }
  }
}
