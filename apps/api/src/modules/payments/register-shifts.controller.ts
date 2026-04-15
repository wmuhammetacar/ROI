import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { CloseRegisterShiftDto } from './dto/close-register-shift.dto';
import { ListRegisterShiftsDto } from './dto/list-register-shifts.dto';
import { OpenRegisterShiftDto } from './dto/open-register-shift.dto';
import { PaymentsService } from './payments.service';

@Controller('register-shifts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.CASHIER)
export class RegisterShiftsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Post('open')
  open(@Body() dto: OpenRegisterShiftDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.openRegisterShift(user.branchId, user.sub, dto);
  }

  @Post(':id/close')
  close(@Param('id') id: string, @Body() dto: CloseRegisterShiftDto, @CurrentUser() user: AuthUser) {
    return this.paymentsService.closeRegisterShift(user.branchId, id, user.sub, dto);
  }

  @Get('open/current')
  async currentOpen(@Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.paymentsService.getCurrentOpenRegisterShift(branchId, user.sub);
  }

  @Get(':id/summary')
  async summary(@Param('id') id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.paymentsService.getRegisterShiftSummary(branchId, id);
  }

  @Get(':id/payments')
  async payments(@Param('id') id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.paymentsService.getRegisterShiftPayments(branchId, id);
  }

  @Get(':id/orders')
  async orders(@Param('id') id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.paymentsService.getRegisterShiftOrders(branchId, id);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.paymentsService.getRegisterShiftById(branchId, id);
  }

  @Get()
  async findAll(@Query() query: ListRegisterShiftsDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.paymentsService.listRegisterShifts(branchId, query);
  }
}
