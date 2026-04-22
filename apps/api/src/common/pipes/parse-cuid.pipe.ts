import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const CUID_PATTERN = /^c[a-z0-9]{24}$/;

@Injectable()
export class ParseCuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !CUID_PATTERN.test(value)) {
      throw new BadRequestException('Invalid id format');
    }

    return value;
  }
}

