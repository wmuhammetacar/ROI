import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { GetOperationsOverviewDto } from './dto/get-operations-overview.dto';
import { OperationsService } from './operations.service';

@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
export class OperationsController {
  constructor(
    private readonly operationsService: OperationsService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get('overview')
  async getOverview(@Query() query: GetOperationsOverviewDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.operationsService.getOverview(branchId, query.orderLimit);
  }
}
