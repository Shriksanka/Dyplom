import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { btoa } from 'buffer';
import { createClient, ZendeskClient } from 'node-zendesk';
import { DateTime } from 'luxon';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Repository } from '../../database/redis/core/repository';
import { InjectRepository } from '../../database/redis/core/decoratos';
import { SupportTickets } from '../../database/redis/schemas/support-tickets.schema';
import { ZendeskTicketUpdateDto } from '../../bots/so/dto/slip.dto';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';
import { CreateTicketParams, Ticket, UpsertTicketResponse } from './types';
import { GmailService } from '../googleapis/gmail/gmail.service';
import { User } from 'node-zendesk/dist/types/clients/core/users';
import { ZENDESK_CUSTOM_FIELDS } from './custom-fields';
import { createZendeskTicketPayload } from '../../bots/so/types';

@Injectable()
export class ZendeskService {
  private zendesk: ZendeskClient;

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
    @InjectRepository('SupportTickets')
    private readonly supportTicketsRepo: Repository,
    @InjectBot('so') private bot: Telegraf,
    private readonly gmailService: GmailService,
  ) {
    this.zendesk = createClient({
      username: this.configService.get('ZENDESK_USERNAME'),
      token: this.configService.get('ZENDESK_TOKEN'),
      subdomain: this.configService.get('ZENDESK_DOMAIN'),
    });

    this.httpService.axiosRef.interceptors.response.use(
      (resp) => {
        return resp;
      },
      (error) => {
        if (error.response) {
          console.error(error.response.data);
        }

        return Promise.reject(error);
      },
    );
  }

  private _getToken(): string {
    const token = btoa(
      `${this.configService.get(
        'ZENDESK_USERNAME',
      )}/token:${this.configService.get('ZENDESK_TOKEN')}`,
    );

    return token;
  }

  async createTicket(params: CreateTicketParams) {
    const isProd = this.configService.get<string>('APP_ENV') === 'production';

    const formattedComment = `
      Order ID: ${params.orderId || 'not provided'}
      Issue type: ${params.issueType || 'not provided'}
      Amount: ${params.amount || 'not provided'}
      UPI ID: ${params.upiId || 'not provided'}
      UTR: ${params.utr || 'not provided'}
      Date: ${DateTime.now().toFormat('MM/dd')}
      Additional Info: ${params.message || 'not provided'}
    `;

    let user: User = null;

    if (params.telegramInfo) {
      const searchQuery = `user_fields.support_description:"Telegram_user_ID: ${params.telegramInfo.userId}"`;

      // Check if we got this user in our support agents list
      [user] = await this.zendesk.users.search({
        query: searchQuery,
      });
    }

    const filename = `slip_${params.orderId.replace(' ', '')}.png`;

    let attachmentTokens = [];

    let commentBody = formattedComment;

    if (params.imageUrl) {
      const attachmentRes = await this.uploadBase64Attachment(
        params.imageUrl,
        'image/png',
        filename,
      );

      const attachmentUrl = attachmentRes.attachment.content_url;

      commentBody = `${formattedComment}\n\n![Embedded Image](${attachmentUrl})`; // Markdown image link

      // Save main slip image upload token
      attachmentTokens.push(attachmentRes.token);
    }

    let otherAttachmentsRes = [];
    try {
      otherAttachmentsRes = await Promise.all(
        params.assets.map((asset) =>
          this.uploadBase64Attachment(
            asset.base64Data,
            asset.mimeType,
            asset.fileName,
          ),
        ),
      );
    } catch (err) {
      console.error('Zendesk upload attachments error ->>>', err);
    }

    // Save other upload tokens
    attachmentTokens = [
      ...attachmentTokens,
      ...otherAttachmentsRes.map((uploadRes) => uploadRes.token),
    ];

    let ticketSubject = `Unknown chat | ${params.orderId}`;
    if (params.telegramInfo) {
      ticketSubject = `${isProd ? '' : '[TEST]'}${
        params.telegramInfo.channelName
      } | ${params.orderId}`;
    }
    if (params.emailInfo) {
      ticketSubject = `XM merchant | ${params.orderId}`;
    }

    const ticketCreateObj: Ticket = {
      ticket: {
        comment: {
          body: commentBody,
          uploads: attachmentTokens,
        },
        subject: ticketSubject,
        priority: 'medium',
        custom_fields: this._buildCustomFields(params),
        tags: !isProd ? ['so_bot_staging'] : ['so_bot'],
      },
    };

    if (user) {
      ticketCreateObj.ticket.requester = {
        name: user.name,
        email: user.email,
      };
    }

    const { data } = await firstValueFrom(
      this.httpService.post('/tickets', ticketCreateObj, {
        headers: {
          Authorization: `Basic ${this._getToken()}`,
        },
      }),
    );

    // Cache ticket to Redis for stable ticket search by orderId
    await this.supportTicketsRepo.save<SupportTickets>(params.orderId, {
      ticketId: data.ticket.id.toString(),
    });
    await this.supportTicketsRepo.expireAt(params.orderId, 300);

    return data.ticket;
  }

  private _buildCustomFields(params: CreateTicketParams) {
    const custom_fields = [];

    return custom_fields;
  }

  //TODO: Refactor this method
  private async uploadBase64Attachment(
    base64Content: string,
    mimeType: string,
    filename: string,
  ): Promise<any> {
    const url = `/uploads.json?filename=${encodeURIComponent(filename)}`;
    let content = Buffer.from(base64Content, 'base64');
    const contentPrefix = `data:${mimeType};base64,`;
    if (base64Content.startsWith(contentPrefix)) {
      content = Buffer.from(
        base64Content.substring(contentPrefix.length),
        'base64',
      );
    }

    const axiosResponse = await firstValueFrom(
      this.httpService.post(url, content, {
        headers: {
          Authorization: `Basic ${this._getToken()}`,
          'Content-Type': mimeType,
          'Content-Transfer-Encoding': 'base64',
        },
      }),
    );

    const attachment = axiosResponse.data.upload;

    return attachment;
  }

  private async _getTicket(supportTicketId: string) {
    const { data } = await this.httpService.axiosRef.get(
      `/tickets/${supportTicketId}`,
      {
        headers: {
          Authorization: `Basic ${this._getToken()}`,
        },
      },
    );

    return data.ticket || null;
  }

  private async _getTicketsBySubjectSubstring(substring: string): Promise<{
    results: any[];
    count: number;
  }> {
    const response = await this.httpService.axiosRef.get('/search', {
      params: { query: `type:ticket subject:"*${substring}*"` },
      headers: {
        Authorization: `Basic ${this._getToken()}`,
      },
    });

    return response.data;
  }

  async checkTicketByOrderId(orderId: string): Promise<any | null> {
    const { ticketId } = await this.supportTicketsRepo.fetch<SupportTickets>(
      orderId,
    );

    if (ticketId) {
      const existingTicket = this._getTicket(ticketId);

      return existingTicket;
    }

    const existingTickets = await this._getTicketsBySubjectSubstring(orderId);

    if (existingTickets.count > 0) {
      const [result] = existingTickets.results;

      return result;
    }
  }

  async getTicketComments(
    supportTicketId: string,
    filterByStatus?: 'public' | 'private',
  ) {
    const { data } = await this.httpService.axiosRef.get(
      `/tickets/${supportTicketId}/comments`,
      {
        headers: {
          Authorization: `Basic ${this._getToken()}`,
        },
        params: {
          sort: '-created_at',
        },
      },
    );

    let comments = data.comments || [];

    // Zendesk do not support filtering comments via API
    if (filterByStatus === 'public') {
      comments = comments.filter((comment) => comment.public);
    }
    if (filterByStatus === 'private') {
      comments = comments.filter((comment) => comment.public);
    }
    // Filter first data comment which should not be sent to user
    comments = comments.filter(
      (comment) => !comment.body.includes('Additional Info:'),
    );

    return comments;
  }

  async getTicketLatestUpdates(supportTicketId: string) {
    const ticket = await this._getTicket(supportTicketId);

    if (!ticket) return null;

    const [ticketField] = ticket?.custom_fields?.filter(
      (field) => field.id === 19969427677981, // This is id of the custom "Telegram info" field
    );

    const comments = await this.getTicketComments(supportTicketId);

    return {
      ticket,
      telegramInfo: ticketField?.value || '',
      latestComment: comments[comments.length - 1]?.body || '',
      status: ticket.status,
    };
  }

  async updateTelegramInfoInZendesk(
    supportTicketId: string,
    messageId: number,
  ) {
    const ticket = await this._getTicket(supportTicketId);

    const telegramInfoField = ticket?.custom_fields?.find(
      (field) => field.id === 19969427677981,
    );

    if (!telegramInfoField || typeof telegramInfoField.value !== 'string')
      return;

    const updatedValue = telegramInfoField.value
      .replace(/Telegram_message_ID:.*$/m, `Telegram_message_ID: ${messageId}`)
      .replace(
        /Telegram_message_thread_ID:.*$/m,
        `Telegram_message_thread_ID: undefined`,
      );

    const body = {
      ticket: {
        custom_fields: [
          {
            id: 19969427677981,
            value: updatedValue,
          },
        ],
      },
    };
    await this.httpService.axiosRef.put(
      `/tickets/${supportTicketId}.json`,
      body,
      {
        headers: {
          Authorization: `Basic ${this._getToken()}`,
        },
      },
    );
  }

  async sendZendeskTicketUpdate(
    ticketUpdateObj: ZendeskTicketUpdateDto,
  ): Promise<string> {
    try {
      console.log('sendZendeskTicketUpdate webhook ->>>', ticketUpdateObj);

      if (!ticketUpdateObj.ticket_id) {
        throw new Error('Ticket not found');
      }

      let finalMessage = '';

      if (ticketUpdateObj.event_type === 'ticket_created') {
        finalMessage = `Support ticket #${ticketUpdateObj.ticket_id} created.\n\nStay informed how the Ticket processing goes. Please, use /followup to check the Ticket status later.`;
      }

      if (ticketUpdateObj.event_type === 'ticket_comment_added') {
        const targetStatus =
          ticketUpdateObj.ticket_status === 'Open'
            ? 'In progress'
            : ticketUpdateObj.ticket_status;
        // Support order ID extraction for older tickets (without 'Order Id' field)
        const subjectParts = ticketUpdateObj.subject.split('|');
        const orderId = ticketUpdateObj.order_id
          ? ticketUpdateObj.order_id
          : subjectParts[subjectParts.length - 1];
        // Publlic comment in Zendesk includes name of the agent and date of the message
        // name of the agent and date of the message separated by newline characters
        const commentParts = ticketUpdateObj.comment.split('\n');
        const finalComment = commentParts
          .slice(3, commentParts.length)
          .join('\n');

        finalMessage = `Ticket #${
          ticketUpdateObj.ticket_id
        } update: \nOrderID: ${orderId.trim()} \n${
          targetStatus ? `Status: ${targetStatus}` : ''
        } \n${finalComment}`;
      }

      if (ticketUpdateObj.telegram_info.trim()) {
        await this.sendReplyMessageTelegram(ticketUpdateObj, finalMessage);
      }

      if (ticketUpdateObj.email_info.trim()) {
        await this.sendReplyMessageEmail(ticketUpdateObj, finalMessage);
      }

      return 'success';
    } catch (err) {
      console.log('sendZendeskTicketUpdate webhook error ->>>', err);
      return 'success';
    }
  }

  async sendReplyMessageTelegram(
    ticketUpdateObj: ZendeskTicketUpdateDto,
    message: string,
  ): Promise<void> {
    if (!ticketUpdateObj.telegram_info) {
      throw new Error('Telegram info is not provided');
    }

    const [, chatId, messageId, messageThreadId] =
      this._getTelegramInfo(ticketUpdateObj);

    const pnp1VipChats = [-2299679112, 1002299679112, -1002299679112];
    const isPnpVipChat = pnp1VipChats.includes(chatId);

    const telegramMessageFormat = !Number.isNaN(messageThreadId)
      ? {
          message_thread_id: messageThreadId,
        }
      : {
          reply_parameters: {
            message_id: messageId,
          },
        };

    if (ticketUpdateObj.event_type === 'ticket_created') {
      await this.bot.telegram.sendMessage(
        chatId,
        message,
        telegramMessageFormat,
      );
    }

    if (ticketUpdateObj.event_type === 'ticket_comment_added') {
      await this.bot.telegram.sendMessage(
        chatId,
        `${message}${isPnpVipChat ? '\n@PUcomFinBot' : ''}`,
        telegramMessageFormat,
      );
    }
  }

  private async sendReplyMessageEmail(
    ticketUpdateObj: ZendeskTicketUpdateDto,
    message: string,
  ) {
    if (!ticketUpdateObj.email_info) {
      throw new Error('Email info is not provided');
    }

    const [senderAddress, cc, messageThreadId, messageOriginalId, subject] =
      this._getEmailInfo(ticketUpdateObj);

    if (ticketUpdateObj.event_type === 'ticket_comment_added') {
      await this.gmailService.sendGmailReply({
        toEmail: senderAddress,
        cc,
        fromEmail: this.configService.get<string>('GMAIL_SLIP_UPLOAD_ADDRESS'),
        threadId: messageThreadId,
        subject,
        messageText: message,
        originalMessageId: messageOriginalId,
      });

      console.log('Zendesk webhook email message sent');
    }
  }

  private _getEmailInfo(updateObj: ZendeskTicketUpdateDto) {
    const emailInfoParts = updateObj.email_info.split('\n');

    return emailInfoParts.map((part) => {
      let value = part.split(':')?.[1]?.trim();

      if (!value) {
        throw new Error('Missing part in email_info field');
      }

      if (value === 'undefined') {
        value = null;
      }

      return value;
    });
  }

  private _getTelegramInfo(updateObj: ZendeskTicketUpdateDto) {
    const telegramInfoParts = updateObj.telegram_info.split('\n');

    return telegramInfoParts.map((part) => {
      const value = part.split(':')?.[1]?.trim();
      if (!value) {
        throw new Error('Missing part in telegram_info field');
      }

      return parseInt(value);
    });
  }

  async upsertTicket(
    params: createZendeskTicketPayload,
  ): Promise<UpsertTicketResponse> {
    try {
      const existingTicket = await this.checkTicketByOrderId(params.orderId);

      if (existingTicket) {
        const ticketComments = await this.getTicketComments(
          existingTicket.id,
          'public',
        );

        return {
          ticketId: existingTicket.id,
          message: `Please be informed that ticket #${
            existingTicket.id
          } has been already created for the order ID ${
            params.orderId
          }.\nStatus: ${existingTicket.status}\nLast comment: ${
            ticketComments[ticketComments.length - 1]?.body || ''
          }`,
        };
      }

      const createdTicket = await this.createTicket(params);

      return {
        ticketId: createdTicket.id,
        message: `\nSupport ticket #${createdTicket.id} created for Order <b>${params.orderId}</b>\n\nStay informed how the Ticket processing goes. Please, use /followup to check the Ticket status later.`,
      };
    } catch (error) {
      console.error(error);
      return {
        message: `\nPlease create support ticket for Order <b>${params.orderId}</b>.`,
      };
    }
  }
}
