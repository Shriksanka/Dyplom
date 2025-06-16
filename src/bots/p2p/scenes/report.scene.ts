import { Injectable } from '@nestjs/common';
import { Ctx, Scene, SceneEnter } from 'nestjs-telegraf';
import { SceneContext } from 'telegraf/scenes';
import { ReportTriggersService } from '../strategy/triggers/report-trigger.service';

@Injectable()
@Scene('report')
export class ReportScene {
  constructor(private readonly triggerService: ReportTriggersService) {}

  @SceneEnter()
  async enter(@Ctx() ctx: SceneContext) {
    const trigger = this.triggerService
      .getAll()
      .find((t) => t.type === 'capacity-summary');

    if (!trigger) {
      return ctx.scene.leave();
    }

    const strategy = this.triggerService['strategiesService'].getStrategy(
      trigger.type,
    );

    if (!strategy) {
      return ctx.scene.leave();
    }

    const dto = await trigger.getData();
    const message = await strategy.generateReport(dto);

    await ctx.reply(message, { parse_mode: 'HTML' });

    ctx.scene.leave();
  }
}
