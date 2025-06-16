import {
  Body,
  Controller,
  Headers,
  Get,
  Post,
  Res,
  HttpStatus,
  Delete,
  Param,
} from '@nestjs/common';
import { BotService } from './bot.sevice';
import { Response } from 'express';

@Controller('/bots')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Get('/')
  async findAll(@Res() res: Response) {
    const bots = await this.botService.getBots();

    res.status(HttpStatus.OK).json({
      list: bots,
    });
  }

  @Post('/')
  async createBot(@Body() body: { name: string }, @Res() res: Response) {
    await this.botService
      .createBot({
        name: body.name,
      })
      .then((bot) => {
        res.status(HttpStatus.CREATED).json({
          data: bot,
        });
      })
      .catch((error) => {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: error.message,
        });
      });
  }

  @Delete(':id')
  async deleteBot(@Param() params: { id: number }, @Res() res: Response) {
    await this.botService
      .deleteBot(params.id)
      .then(() => {
        res.status(HttpStatus.NO_CONTENT).send();
      })
      .catch((error) => {
        res.status(HttpStatus.BAD_REQUEST).json({
          error: error.message,
        });
      });
  }
}
