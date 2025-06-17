import { Update, Ctx, Start, Action, Command } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { callbackQuery } from 'telegraf/filters';
import { InjectRepository } from '../../database/redis/core/decoratos';
import { Repository } from '../../database/redis/core/repository';
import { Helpers } from '../../common/helpers';
import { PaymentService } from '../../common/payment-service/payment-service.service';
import { SceneContext } from 'telegraf/scenes';

@Update()
export class P2pUpdates {
  constructor(
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
}
