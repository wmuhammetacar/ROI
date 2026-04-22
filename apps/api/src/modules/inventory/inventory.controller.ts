import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { GetInventorySummaryDto } from './dto/get-inventory-summary.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get('summary')
  @Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
  async getSummary(@Query() query: GetInventorySummaryDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.getInventorySummary(branchId, query);
  }
}
