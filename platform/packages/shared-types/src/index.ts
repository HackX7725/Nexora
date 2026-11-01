export const EVENT_VERSION = 1 as const;

export interface EncryptionHeader {
  algorithm: string;
  keyVersion: number;
}

export interface SendMessageEvent {
  eventVersion: 1;
  conversationId: string;
  clientMessageId: string;
  senderDeviceId: string;
  ciphertext: string;
  encryptionHeader: EncryptionHeader;
  attachmentIds?: string[];
  replyToMessageId?: string;
  createdAt: string;
}

export interface AcceptedMessage {
  id: string;
  clientMessageId: string;
  conversationId: string;
  sequenceNumber: number;
  status: 'accepted';
  createdAt: string;
}

export interface StoredMessage extends AcceptedMessage {
  senderDeviceId: string;
  senderUserId: string;
  ciphertext: string;
  encryptionHeader: EncryptionHeader;
  replyToMessageId: string | null;
}
