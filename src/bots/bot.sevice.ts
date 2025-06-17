import { Injectable } from '@nestjs/common';

@Injectable()
export class BotService {
  constructor(@InjectModel(Bot) private readonly botModel: typeof Bot) {}

  async getBots<T extends { id: number; name: string }>(): Promise<T[]> {
    const bots = await this.botModel.findAll();

    return bots.map((bot) => {
      return {
        id: bot.id,
        name: bot.name,
      } as T;
    });
  }

  async createBot<T extends { name: string }>(data: T): Promise<object> {
    const { name } = data;

    if (await this.botModel.count({ where: { name } })) {
      throw new Error(`Bot with name [${name}] already exists`);
    }

    const bot = await this.botModel.create({ name });

    return { id: bot.id, name };
  }

  async deleteBot(id: number): Promise<void> {
    await this.botModel
      .destroy({
        where: {
          id,
        },
      })
      .catch((error) => {
        console.error('error >>> ', error.message);

        throw new Error('There are users with this bot, you cannot delete it');
      });
  }
}
