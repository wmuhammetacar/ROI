import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';
import { PublicMenuQueryDto } from './dto/public-menu-query.dto';
import { PublicOrderingService } from './public-ordering.service';

const PUBLIC_RATE_LIMIT_MAX = Number(process.env.PUBLIC_RATE_LIMIT_MAX ?? 30);
const PUBLIC_RATE_LIMIT_TTL_MS = Number(process.env.RATE_LIMIT_TTL_SECONDS ?? 60) * 1000;

@Controller('public')
export class PublicOrderingController {
  constructor(private readonly publicOrderingService: PublicOrderingService) {}

  @Get('menu')
  @Throttle({
    default: {
      limit: Math.max(1, PUBLIC_RATE_LIMIT_MAX * 3),
      ttl: PUBLIC_RATE_LIMIT_TTL_MS,
    },
  })
  getMenu(@Query() query: PublicMenuQueryDto) {
    return this.publicOrderingService.getPublicMenu(query);
  }

  @Post('orders')
  @Throttle({ default: { limit: Math.max(1, PUBLIC_RATE_LIMIT_MAX), ttl: PUBLIC_RATE_LIMIT_TTL_MS } })
  createOrder(
    @Body() dto: CreatePublicOrderDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.publicOrderingService.createPublicOrder(dto, { idempotencyKey });
  }
}
