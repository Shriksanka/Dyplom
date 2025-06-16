import { getCurrentInvoke } from '@codegenie/serverless-express';
import { Controller, Headers, Post } from '@nestjs/common';
import { TelegramMtprotoService } from './common/telegram-mtproto/telegram-mtproto.service';
import { SuccessOrderService } from './bots/so/so.service';
import { ReportTriggersService } from './bots/p2p/strategy/triggers/report-trigger.service';

@Controller()
export class AppController {
  constructor(
    private readonly telegramService: TelegramMtprotoService,
    private readonly successOrderService: SuccessOrderService,
    private readonly reportTriggerService: ReportTriggersService,
  ) {}

  @Post('step-functions')
  async stepFunctionsHandler(@Headers() headers: any) {
    const { event } = getCurrentInvoke();

    const session = await this.telegramService.getSession();
    if (session) {
      await this.telegramService.processChatMessages(event.chat_id);
    }

    await this.successOrderService.emailSlipHandler();

    await this.reportTriggerService.runAllIfDue();

    console.log('headers >>>', headers);

    return { message: 'ok' };
  }
}
