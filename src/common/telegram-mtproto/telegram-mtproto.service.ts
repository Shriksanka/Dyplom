import { Injectable } from '@nestjs/common';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '../../database/redis/core/decoratos';
import { Repository } from '../../database/redis/core/repository';
import { TelegramState } from '../../database/redis/schemas/telegram-state.schema';
import { ZendeskService } from '../zendesk/zendesk.service';

@Injectable()
export class TelegramMtprotoService {
  private _client: TelegramClient;
  private _apiId: string;
  private _apiHash: string;
  private _phoneNumber: string;
  private _phoneCodeHash: string;
  private _slipHandler: SlipHandler;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository('TelegramState')
    private readonly telegramState: Repository,
    private readonly merchantApiService: MerchantApiService,
    private readonly utrCheckerService: UtrCheckerService,
    private readonly zendeskService: ZendeskService,
    @InjectModel(Request)
    private readonly requestModel: typeof Request,
  ) {
    this._apiId = this.configService.get('TELEGRAM_API_ID');
    this._apiHash = this.configService.get('TELEGRAM_API_HASH');
    this._phoneNumber = this.configService.get('TELEGRAM_PHONE_NUMBER');

    this._slipHandler = new SlipHandler(
      this.merchantApiService,
      this.utrCheckerService,
      this.zendeskService,
      this.requestModel,
      'telegram_proto',
    );
  }

  async registerSession() {
    const sentCode = await this._client.invoke(
      new Api.auth.SendCode({
        phoneNumber: this._phoneNumber,
        apiId: parseInt(this._apiId),
        apiHash: this._apiHash,
        settings: new Api.CodeSettings({}),
      }),
    );
    if (!('phoneCodeHash' in sentCode)) {
      throw new Error('Telegram API did not return phoneCodeHash');
    }
    this._phoneCodeHash = sentCode.phoneCodeHash;
  }

  async enterOtp(code: string) {
    await this._client.invoke(
      new Api.auth.SignIn({
        phoneNumber: this._phoneNumber,
        phoneCode: code,
        phoneCodeHash: this._phoneCodeHash,
      }),
    );
    await this.telegramState.save(this._apiId, {
      session: this._client.session.save(),
    });
  }

  async processChatMessages(chatId: number) {
    if (!this._client) {
      await this._initClient();
    }

    let { last_message_id: lastMessageId } =
      await this.telegramState.fetch<TelegramState>(`${this._apiId}_${chatId}`);

    if (!lastMessageId) {
      const messageObj = (
        await this._client.getMessages(chatId, {
          limit: 1,
        })
      )[0];

      lastMessageId = messageObj.id - 1;
    }

    for await (const message of this._client.iterMessages(chatId, {
      limit: 50,
      minId: lastMessageId,
    })) {
      if (message.id <= lastMessageId) {
        continue;
      }

      if (!message.message?.includes('We have a new ticket')) {
        continue;
      }

      await this.telegramState.save<TelegramState>(`${this._apiId}_${chatId}`, {
        last_message_id: message.id,
      });

      const base64Img = await this._getBase64Image(message.message);
      if (!base64Img) {
        continue;
      }

      const orderId = this._extractOrderId(message.message);
      const channelName = await this._resolveChannelName(chatId);

      const responseMessage = await this._slipHandler.processSlip({
        imageUrl: base64Img,
        assets: [],
        orderId,
        info: {
          telegramInfo: {
            userId: message.senderId?.valueOf(),
            messageId: message.id,
            messageThreadId: message.replyTo?.replyToMsgId || 0,
            chatId,
            channelName,
          },
          fileName: message.file?.name,
        },
      });

      const { message: formattedText, entities } =
        this._formatTelegramMessage(responseMessage);

      await this._client.invoke(
        new Api.messages.SendMessage({
          peer: chatId,
          replyTo: new Api.InputReplyToMessage({ replyToMsgId: message.id }),
          message: formattedText,
          entities,
        }),
      );
    }
  }

  private _formatTelegramMessage(text: string): {
    message: string;
    entities: Api.TypeMessageEntity[];
  } {
    const entities: Api.TypeMessageEntity[] = [];
    const entityMap = {
      b: Api.MessageEntityBold,
      i: Api.MessageEntityItalic,
      u: Api.MessageEntityUnderline,
      s: Api.MessageEntityStrike,
    };

    let message = '';
    let offset = 0;
    let lastIndex = 0;

    const tagRegex = /<(b|i|u|s)>(.*?)<\/\1>/g;

    for (const match of text.matchAll(tagRegex)) {
      const [full, tag, inner] = match;
      const start = match.index;

      const plain = text.slice(lastIndex, start);
      message += plain + inner;

      entities.push(
        new entityMap[tag as keyof typeof entityMap]({
          offset: offset + plain.length,
          length: inner.length,
        }),
      );

      offset += plain.length + inner.length;
      lastIndex = start + full.length;
    }

    message += text.slice(lastIndex);
    return { message, entities };
  }

  async getSession() {
    const { session } = await this.telegramState.fetch<TelegramState>(
      this._apiId,
    );
    return session;
  }

  private async _initClient() {
    const { session } = await this.telegramState.fetch<TelegramState>(
      this._apiId,
    );
    this._client = new TelegramClient(
      new StringSession(session || ''),
      parseInt(this._apiId),
      this._apiHash,
      { connectionRetries: 5 },
    );
    await this._client.connect();

    if (!session) {
      await this.registerSession();
    }
  }

  private _extractOrderId(text: string): string {
    const [, orderId] = text.match(/orderId: (.*)/);
    return orderId;
  }

  private async _getBase64Image(msg: string): Promise<string> {
    const [, link] = msg.match(/(?:img\d+|attachment):\s*(https?:\/\/[^\s]+)/);

    const buffer = await Helpers.downloadFileToBuffer(link);

    return buffer.toString('base64');
  }

  private async _resolveChannelName(chatId: number): Promise<string> {
    const entity = await this._client.getEntity(chatId);
    return (entity as any).title;
  }
}
