export type TelegramObject = {
  userId: number;
  messageId: number;
  messageThreadId: number;
  chatId: number;
  channelName: string;
};

export type UpsertTicketResponse = {
  ticketId?: string;
  message: string;
};

export type Ticket = {
  ticket: {
    comment: {
      body: string;
      uploads?: string[];
    };
    subject: string;
    priority: string;
    requester?: {
      name: string;
      email: string;
    };
    custom_fields?: { id: number; value: any }[];
    tags?: string[];
  };
};
