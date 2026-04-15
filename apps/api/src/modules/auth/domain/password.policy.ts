import { BadRequestException } from '@nestjs/common';

const PASSWORD_MIN_LENGTH = 8;

export function enforcePasswordPolicy(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new BadRequestException(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    throw new BadRequestException('Password must include at least one letter and one number');
  }
}
