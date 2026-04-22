import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { throttlePolicies } from '../../common/throttle/throttle-policies';
import { CreatePublicOrderDto } from './dto/create-public-order.dto';
import { CreatePublicWaiterCallDto } from './dto/create-public-waiter-call.dto';
import { PublicMenuQueryDto } from './dto/public-menu-query.dto';
import { PublicOrderingService } from './public-ordering.service';

@Controller('public')
export class PublicOrderingController {
  constructor(private readonly publicOrderingService: PublicOrderingService) {}

  @Get('menu')
  @Throttle(throttlePolicies.publicMenu)
  getMenu(@Query() query: PublicMenuQueryDto) {
    return this.publicOrderingService.getPublicMenu(query);
  }

  @Post('orders')
  @Throttle(throttlePolicies.publicOrder)
  createOrder(
    @Body() dto: CreatePublicOrderDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.publicOrderingService.createPublicOrder(dto, { idempotencyKey });
  }

  @Post('waiter-calls')
  @Throttle(throttlePolicies.publicOrder)
  createWaiterCall(@Body() dto: CreatePublicWaiterCallDto) {
    return this.publicOrderingService.createPublicWaiterCall(dto);
  }
}
