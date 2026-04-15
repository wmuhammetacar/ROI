import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CreateOrderPaymentDto } from './dto/create-order-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderPaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Post(':id/bill')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER)
  bill(@Param('id') orderId: string, @CurrentUser() user: AuthUser) {
    return this.paymentsService.billOrder(user.branchId, user, orderId);
  }

  @Post(':id/payments')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER)
  createPayment(
    @Param('id') orderId: string,
    @Body() dto: CreateOrderPaymentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.createOrderPayment(user.branchId, user, orderId, dto);
  }

  @Get(':id/payments')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async getOrderPayments(
    @Param('id') orderId: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.paymentsService.getOrderPayments(branchId, user, orderId);
  }

  @Get(':id/refunds')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER, APP_ROLES.WAITER)
  async getOrderRefunds(
    @Param('id') orderId: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.paymentsService.getOrderRefunds(branchId, user, orderId);
  }
}
