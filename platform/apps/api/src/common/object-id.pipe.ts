import { BadRequestException, PipeTransform } from '@nestjs/common';

const objectId = /^[a-f0-9]{24}$/i;

export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!objectId.test(value || '')) throw new BadRequestException('That id is not valid.');
    return value;
  }
}
