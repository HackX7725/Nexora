import { BadRequestException } from '@nestjs/common';

export function directKey(leftUserId: string, rightUserId: string) {
  if (leftUserId === rightUserId) {
    throw new BadRequestException('Choose someone else for a direct chat.');
  }
  return [leftUserId, rightUserId].sort().join(':');
}

export function isReplay(existingMessageId: string | null) {
  return existingMessageId !== null;
}
