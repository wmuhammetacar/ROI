import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 20);
const AUTH_RATE_LIMIT_TTL_MS = Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60) * 1000;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: Math.max(1, AUTH_RATE_LIMIT_MAX), ttl: AUTH_RATE_LIMIT_TTL_MS } })
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    if (this.configService.get<string>('NODE_ENV', 'development') === 'production') {
      throw new ForbiddenException('Public registration is disabled in production');
    }

    return this.authService.register(dto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('login')
  @Throttle({ default: { limit: Math.max(1, AUTH_RATE_LIMIT_MAX), ttl: AUTH_RATE_LIMIT_TTL_MS } })
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
