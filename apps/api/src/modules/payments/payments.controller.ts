import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { VoidPaymentDto } from './dto/void-payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Post(':id/void')
  void(@Param('id') paymentId: string, @Body() dto: VoidPaymentDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.voidPayment(user.branchId, user, paymentId, dto);
  }

  @Post(':id/refunds')
  createRefund(
    @Param('id') paymentId: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentsService.createRefund(user.branchId, user, paymentId, dto);
  }

  @Get(':id/refunds')
  async getRefunds(
    @Param('id') paymentId: string,
    @Query() query: ReadBranchScopeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.paymentsService.getPaymentRefunds(branchId, paymentId);
  }
}
