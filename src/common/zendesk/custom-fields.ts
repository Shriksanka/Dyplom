import { CreateTicketParams } from './types';

export const ZENDESK_CUSTOM_FIELDS = {
  TELEGRAM_CHAT_INFO: (params: CreateTicketParams) => {
    return {
      id: 19969427677981,
      value: `Telegram_user_ID: ${params.telegramInfo.userId}
Telegram_channel_ID: ${params.telegramInfo.chatId}
Telegram_message_ID: ${params.telegramInfo.messageId}
Telegram_message_thread_ID: ${params.telegramInfo.messageThreadId}`,
    };
  },
  UTR: (params: CreateTicketParams) => {
    return {
      id: 19761610687133,
      value: params.utr,
    };
  },
  ORDER_ID: (params: CreateTicketParams) => {
    return {
      id: 25674704597661,
      value: params.orderId,
    };
  },
};
