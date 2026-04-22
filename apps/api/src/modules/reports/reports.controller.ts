import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { ReadBranchScopeQueryDto } from '../../common/dto/read-branch-scope-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { ReportsLimitDto, ReportsScopeDto } from './dto/reports-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get('dashboard-summary')
  async getDashboardSummary(@Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.reportsService.getDashboardSummary(branchId);
  }

  @Get('sales-summary')
  async getSalesSummary(@Query() query: ReportsScopeDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.reportsService.getSalesSummary(branchId, { shiftId: query.shiftId });
  }

  @Get('payment-mix')
  async getPaymentMix(@Query() query: ReportsScopeDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.reportsService.getPaymentMix(branchId, { shiftId: query.shiftId });
  }

  @Get('orders-summary')
  async getOrdersSummary(@Query() query: ReadBranchScopeQueryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.reportsService.getOrdersSummary(branchId);
  }

  @Get('inventory-summary')
  async getInventorySummary(@Query() query: ReportsLimitDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.reportsService.getInventorySummary(branchId, { limit: query.limit });
  }

  @Get('operations-summary')
  async getOperationsSummary(@Query() query: ReportsLimitDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.reportsService.getOperationsSummary(branchId, { limit: query.limit });
  }

  @Get('shifts-overview')
  async getShiftsOverview(@Query() query: ReportsLimitDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.reportsService.getShiftsOverview(branchId, { limit: query.limit });
  }
}
