import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { APP_ROLES } from '../../common/constants/roles';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthUser } from '../../common/interfaces/auth-user.interface';
import { BranchScopeResolverService } from '../branches/branch-scope-resolver.service';
import { ListStockMovementsDto } from './dto/list-stock-movements.dto';
import { InventoryService } from './inventory.service';

@Controller('stock-movements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(APP_ROLES.ADMIN, APP_ROLES.MANAGER, APP_ROLES.CASHIER)
export class StockMovementsController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly branchScopeResolver: BranchScopeResolverService,
  ) {}

  @Get()
  async findAll(@Query() query: ListStockMovementsDto, @CurrentUser() user: AuthUser) {
    const branchId = await this.branchScopeResolver.resolveReadBranchId(user, query.branchId);
    return this.inventoryService.listStockMovements(branchId, query);
  }
}
