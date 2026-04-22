import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { throttlePolicies } from '../../common/throttle/throttle-policies';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { StaffLoginDto } from './dto/staff-login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle(throttlePolicies.auth)
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    if (this.configService.get<string>('NODE_ENV', 'development') === 'production') {
      throw new ForbiddenException('Public registration is disabled in production');
    }

    return this.authService.register(dto, {
      ipAddress: (request.headers['x-forwarded-for'] as string) || request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('login')
  @Throttle(throttlePolicies.auth)
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, {
      ipAddress: (request.headers['x-forwarded-for'] as string) || request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('staff-login')
  @Throttle(throttlePolicies.auth)
  @HttpCode(HttpStatus.OK)
  staffLogin(@Body() dto: StaffLoginDto, @Req() request: Request) {
    return this.authService.staffLogin(dto, {
      ipAddress: (request.headers['x-forwarded-for'] as string) || request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
